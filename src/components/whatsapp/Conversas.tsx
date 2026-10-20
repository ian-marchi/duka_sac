'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { timeAgo } from '@/lib/format'
import { marcarLidas, responder, setPonte } from '@/app/(painel)/whatsapp/actions'

export type ConversaResumo = { telefone: string; nome: string | null; conta: string | null; userId: string | null; ultima: string; ultimaCorpo: string; ultimaDirecao: 'entrada' | 'saida'; naoLidas: number; total: number }
export type Mensagem = { quando: string; de: string; corpo: string; tipo: string; nossa: boolean; pendente?: boolean }
export type FilaResumo = { tipo: string; status: string; n: number; ultima: string }

const TIPO: Record<string, string> = {
  recebido: 'Entrou em análise', resolvido: 'Ticket resolvido', manual: 'Resposta do painel', codigo: 'Código de telefone',
  atualizacao: 'Aviso de atualização', resgate: 'Resgate', campanha: 'Campanha', escola: 'Convite de escola', claude: 'Claude (ponte)',
}
const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: 'na fila', cls: 'text-p1' }, sent: { label: 'enviadas', cls: 'text-ok' }, failed: { label: 'falharam', cls: 'text-p0' },
  skipped: { label: 'descartadas', cls: 'text-muted' }, draft: { label: 'rascunho', cls: 'text-brandText' },
}
const tel = (t: string) => t.replace(/^55(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function Conversas({ lista, mensagens, telAberto, fila, ponte, botLigado }: {
  lista: ConversaResumo[]; mensagens: Mensagem[]; telAberto: string | null; fila: FilaResumo[]; ponte: boolean; botLigado: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [texto, setTexto] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const aberta = telAberto ? lista.find((c) => c.telefone === telAberto) ?? null : null
  const naoLidas = lista.reduce((n, c) => n + c.naoLidas, 0)
  const naFila = fila.filter((f) => f.status === 'queued').reduce((n, f) => n + f.n, 0)

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, okMsg: string) =>
    start(async () => { setMsg(null); const r = await fn(); setMsg(r.ok ? okMsg : `Erro: ${r.erro ?? 'não deu'}`); router.refresh() })

  return (
    <div className="grid gap-4 md:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="card-h">Ponte com o Claude</h3>
            <button type="button" className="clay px-3 py-1 text-[11px]" disabled={pending}
              onClick={() => rodar(() => setPonte(!ponte), ponte ? 'Ponte desligada.' : 'Ponte ligada.')}>
              {ponte ? 'Desligar' : 'Ligar'}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-fg2">
            <span className={`rounded-full border px-2 py-0.5 font-display text-[10px] font-extrabold ${ponte ? 'border-ok/50 bg-ok/15 text-ok' : 'border-border bg-elev text-fg2'}`}>{ponte ? 'LIGADA' : 'DESLIGADA'}</span>
            {' '}· bot {botLigado ? 'lendo a fila' : 'com a fila desligada'}
          </p>
          <p className="kicker mt-2">Ligada: respostas que o Claude escreve saem na hora, só pra quem já conversou com o número. Desligada: ficam na fila pro <code>!fila enviar</code>.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div><div className={`font-display text-xl font-extrabold ${naoLidas ? 'text-p1' : ''}`}>{naoLidas}</div><div className="kicker">não lidas</div></div>
            <div><div className={`font-display text-xl font-extrabold ${naFila ? 'text-p1' : ''}`}>{naFila}</div><div className="kicker">na fila do bot</div></div>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="card-h">Fila do bot</h3>
          {fila.length === 0 ? <p className="mt-1 text-xs text-muted">Nada ainda.</p> : (
            <table className="mt-2 w-full text-[11px]">
              <tbody>
                {fila.map((f) => { const st = STATUS[f.status] ?? { label: f.status, cls: 'text-muted' }; return (
                  <tr key={`${f.tipo}|${f.status}`} className="border-t border-border">
                    <td className="py-1">{TIPO[f.tipo] ?? f.tipo}</td>
                    <td className={`text-right font-display font-extrabold ${st.cls}`}>{f.n}</td>
                    <td className={`pl-2 ${st.cls}`}>{st.label}</td>
                    <td className="pl-2 text-right text-muted" title={hora(f.ultima)}>{timeAgo(f.ultima)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-0">
          <div className="px-4 pt-4"><h3 className="card-h">Conversas ({lista.length})</h3></div>
          <div className="mt-2 max-h-[60vh] overflow-y-auto">
            {lista.length === 0 && <p className="px-4 pb-4 text-xs text-muted">Nenhuma mensagem gravada ainda. O bot grava tudo que chega depois do <code>git pull</code> + reinício.</p>}
            {lista.map((c) => (
              <Link key={c.telefone} href={`/whatsapp/conversas?tel=${c.telefone}`}
                className={`flex items-start gap-2 border-t border-border px-4 py-2.5 text-xs hover:bg-elev ${c.telefone === telAberto ? 'bg-elev' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold">{c.nome ?? tel(c.telefone)}</span>
                    {c.conta && <span className="text-muted">@{c.conta}</span>}
                    {c.naoLidas > 0 && <span className="ml-auto rounded-full bg-p1 px-1.5 font-display text-[10px] font-extrabold text-white">{c.naoLidas}</span>}
                  </div>
                  <div className="truncate text-muted">{c.ultimaDirecao === 'saida' ? 'nós: ' : ''}{c.ultimaCorpo}</div>
                </div>
                <span className="shrink-0 text-[10px] text-muted">{timeAgo(c.ultima)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card flex min-h-[70vh] flex-col p-0">
        {!telAberto ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted">Escolha uma conversa à esquerda.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-extrabold">{aberta?.nome ?? tel(telAberto)}</div>
                <div className="text-[11px] text-muted">
                  {tel(telAberto)}
                  {aberta?.conta && <> · <Link href={`/alunos?u=${aberta.userId}`} className="underline">@{aberta.conta}</Link></>}
                  {!aberta?.conta && ' · sem conta no app'}
                </div>
              </div>
              {aberta && aberta.naoLidas > 0 && (
                <button type="button" className="clay px-3 py-1 text-[11px]" disabled={pending} onClick={() => rodar(() => marcarLidas(telAberto), 'Marcadas como lidas.')}>Marcar como lida</button>
              )}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {mensagens.length === 0 && <p className="text-xs text-muted">Sem mensagens gravadas pra este número.</p>}
              {mensagens.map((m, i) => (
                <div key={i} className={`flex ${m.nossa ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs ${m.nossa ? (m.pendente ? 'border border-dashed border-p1 bg-bg text-fg2' : 'bg-brandSoft text-brandText') : 'bg-elev'}`}>
                    <div className="whitespace-pre-wrap">{m.corpo}</div>
                    <div className="mt-1 text-[10px] text-muted">{m.de} · {hora(m.quando)}{m.pendente ? ' · aguardando o bot' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <form className="border-t border-border p-3" onSubmit={(ev) => { ev.preventDefault(); const t = texto; rodar(() => responder(telAberto, t), 'Na fila do bot. Libere com !fila enviar (ou sai sozinha no modo auto).'); setTexto('') }}>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className="input w-full text-xs" placeholder="Responder por aqui: entra na fila do bot e sai pelo WhatsApp do Duka." />
              <div className="mt-2 flex items-center gap-2">
                <span className="kicker">Vai como "Resposta do painel"; o bot manda quando você liberar.</span>
                <button type="submit" className="clay ml-auto px-3 py-1.5 text-[12px]" disabled={pending || !texto.trim()}>{pending ? '…' : 'Enfileirar resposta'}</button>
              </div>
            </form>
          </>
        )}
      </div>
      {msg && <div className="text-[11px] text-fg2 md:col-span-2">{msg}</div>}
    </div>
  )
}
