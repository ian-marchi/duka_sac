'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EscolaRow, AlunoRow } from '@/app/(painel)/escolas/[id]/page'
import { adicionarAlunos, convidar, editarEscola, mudarStatus, removerAluno, vincular } from '@/app/(painel)/escolas/actions'

const fmt = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
const tel = (t: string | null) => (t ? t.replace(/^55(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') : '—')

const STATUS_ALUNO: Record<AlunoRow['status'], { label: string; cls: string; dica: string }> = {
  pendente: { label: 'Sem conta', cls: 'border-p1/50 bg-p1/15 text-p1', dica: 'Ainda não criou a conta no app com este e-mail ou telefone.' },
  conta: { label: 'Com conta', cls: 'border-brand bg-brandSoft text-brandText', dica: 'Conta encontrada; Premium entra quando a escola estiver ativa.' },
  premium: { label: 'Premium', cls: 'border-ok/50 bg-ok/15 text-ok', dica: 'Premium ativo por conta da escola.' },
  removido: { label: 'Removido', cls: 'border-border bg-elev text-muted', dica: 'Tirado da lista; o Premium da escola foi retirado.' },
}

export function EscolaAcoes({ escola, alunos, modelo, envios }: { escola: EscolaRow; alunos: AlunoRow[]; modelo: string; envios: Record<string, { status: string; quando: string }> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [ddd, setDdd] = useState('34')
  const [editando, setEditando] = useState(false)
  const [mostrarModelo, setMostrarModelo] = useState(false)
  const [modeloEdit, setModeloEdit] = useState(modelo)

  const vivos = alunos.filter((a) => a.status !== 'removido')
  const pendentes = vivos.filter((a) => a.status === 'pendente')
  const paraConvidar = pendentes.filter((a) => a.telefone && (!a.convidado_em || Date.now() - new Date(a.convidado_em).getTime() > 7 * 86400_000))
  const premium = vivos.filter((a) => a.status === 'premium').length

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string; info?: string; n?: number; ignorados?: string[] }>, okMsg: (r: { info?: string; n?: number; ignorados?: string[] }) => string) =>
    start(async () => {
      setMsg(null)
      const r = await fn()
      setMsg(r.ok ? okMsg(r) : `Erro: ${r.erro ?? 'não deu'}`)
      router.refresh()
    })

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-xl font-extrabold">{escola.nome}</h1>
              <span className={`rounded-full border px-2 py-0.5 font-display text-[10px] font-extrabold ${escola.status === 'ativa' ? 'border-ok/50 bg-ok/15 text-ok' : escola.status === 'pausada' ? 'border-p1/50 bg-p1/15 text-p1' : 'border-border bg-elev text-fg2'}`}>{escola.status}</span>
            </div>
            <div className="text-xs text-muted">
              {[escola.cidade, escola.uf].filter(Boolean).join('/') || 'cidade não informada'}
              {escola.contato_nome ? ` · ${escola.contato_nome}` : ''}{escola.contato_telefone ? ` · ${escola.contato_telefone}` : ''}{escola.contato_email ? ` · ${escola.contato_email}` : ''}
            </div>
            <div className="mt-1 text-xs text-fg2">
              Premium {escola.premium_ate ? `até ${escola.premium_ate.split('-').reverse().join('/')}` : 'enquanto a escola estiver ativa'} · <b>{premium}</b> de {vivos.length} alunos com Premium agora
            </div>
            {escola.obs && <div className="mt-1 text-[11px] text-muted">{escola.obs}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="clay px-3 py-1 text-[11px]" disabled={pending} onClick={() => setEditando((v) => !v)}>{editando ? 'Fechar' : 'Editar'}</button>
            {escola.status === 'ativa' ? (
              <button type="button" className="clay px-3 py-1 text-[11px]" disabled={pending}
                onClick={() => { if (confirm('Pausar a escola tira o Premium de todos os alunos dela (voltam pra regra do beta). Continuar?')) rodar(() => mudarStatus(escola.id, 'pausada'), (r) => `Pausada. ${r.info ?? ''}`) }}>
                Pausar assinatura
              </button>
            ) : (
              <button type="button" className="clay px-3 py-1 text-[11px]" disabled={pending}
                onClick={() => rodar(() => mudarStatus(escola.id, 'ativa'), (r) => `Reativada. ${r.info ?? ''}`)}>
                Reativar
              </button>
            )}
            {escola.status !== 'encerrada' && (
              <button type="button" className="clay px-3 py-1 text-[11px] text-p0" disabled={pending}
                onClick={() => { if (confirm('Encerrar a parceria? O Premium de todos os alunos desta escola é retirado.')) rodar(() => mudarStatus(escola.id, 'encerrada'), () => 'Encerrada.') }}>
                Encerrar
              </button>
            )}
          </div>
        </div>

        {editando && (
          <form className="mt-3 grid gap-2 border-t border-border pt-3 md:grid-cols-3" onSubmit={(ev) => { ev.preventDefault(); const f = new FormData(ev.currentTarget); rodar(() => editarEscola(escola.id, f), () => 'Salvo.'); setEditando(false) }}>
            <input name="nome" defaultValue={escola.nome} className="input" placeholder="Nome" />
            <input name="cidade" defaultValue={escola.cidade ?? ''} className="input" placeholder="Cidade" />
            <input name="uf" defaultValue={escola.uf ?? ''} className="input uppercase" placeholder="UF" maxLength={2} />
            <input name="contato_nome" defaultValue={escola.contato_nome ?? ''} className="input" placeholder="Contato" />
            <input name="contato_telefone" defaultValue={escola.contato_telefone ?? ''} className="input" placeholder="Telefone" />
            <input name="contato_email" defaultValue={escola.contato_email ?? ''} className="input" placeholder="E-mail" />
            <label className="text-[11px] text-muted">Premium até<input name="premium_ate" type="date" defaultValue={escola.premium_ate ?? ''} className="input mt-1 w-full" /></label>
            <textarea name="obs" defaultValue={escola.obs ?? ''} className="input md:col-span-2" rows={2} placeholder="Observações" />
            <button type="submit" className="clay px-3 py-1.5 text-[12px] md:col-span-3" disabled={pending}>Salvar</button>
          </form>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_340px]">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="card-h">Alunos ({vivos.length})</h3>
            <button type="button" className="clay px-3 py-1 text-[11px]" disabled={pending} onClick={() => rodar(() => vincular(escola.id), (r) => `Vínculo refeito: ${r.info ?? ''}`)} title="Procura de novo contas do app com estes e-mails/telefones e aplica o Premium">
              {pending ? '…' : 'Vincular contas agora'}
            </button>
          </div>
          <table className="mt-2 w-full text-[11px]">
            <thead><tr className="text-left text-muted"><th className="py-1">Aluno</th><th>Contato</th><th>Status</th><th>Conta no app</th><th>Convite</th><th></th></tr></thead>
            <tbody>
              {alunos.map((a) => {
                const st = STATUS_ALUNO[a.status]
                const env = a.telefone ? envios[a.telefone] : undefined
                return (
                  <tr key={a.id} className={`border-t border-border ${a.status === 'removido' ? 'opacity-50' : ''}`}>
                    <td className="py-1.5 font-bold">{a.nome}</td>
                    <td className="text-fg2"><div>{a.email ?? '—'}</div><div className="font-mono text-muted">{tel(a.telefone)}</div></td>
                    <td><span className={`rounded-full border px-2 py-0.5 font-display text-[10px] font-extrabold ${st.cls}`} title={st.dica}>{st.label}</span></td>
                    <td>
                      {a.conta ? (
                        <Link href={`/alunos?u=${a.user_id}`} className="hover:underline">
                          @{a.conta.username ?? '?'}
                          <div className="text-muted">{a.conta.premium_status === 'premium' ? `premium${a.conta.premium_until ? ` até ${a.conta.premium_until.slice(0, 10).split('-').reverse().join('/')}` : ' (sem data)'}` : 'free'}{a.conta.last_activity_date ? ` · ativo ${a.conta.last_activity_date.split('-').reverse().join('/')}` : ''}</div>
                        </Link>
                      ) : <span className="text-muted">ainda não criou</span>}
                    </td>
                    <td className="text-muted">
                      {a.convidado_em ? <>{fmt(a.convidado_em)}{env ? <div>{env.status === 'sent' ? 'enviado' : env.status === 'queued' ? 'na fila do bot' : env.status}</div> : null}</> : a.telefone ? 'não' : 'sem telefone'}
                    </td>
                    <td className="text-right">
                      {a.status !== 'removido' && (
                        <button type="button" className="text-[10px] text-muted hover:text-p0" disabled={pending}
                          onClick={() => { if (confirm(`Tirar ${a.nome} da lista? O Premium da escola sai da conta.`)) rodar(() => removerAluno(escola.id, a.id), () => 'Removido.') }}>remover</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {alunos.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">Nenhum aluno. Cole a lista ao lado.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="card-h">Colar lista de alunos</h3>
            <p className="kicker mt-1">Como vem do WhatsApp: nome numa linha, e-mail e telefone nas seguintes. Numeração é ignorada.</p>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} className="input mt-2 w-full font-mono text-[11px]" placeholder={'1- MARIA SILVA\n   maria@gmail.com\n   Tel. 34 99999 0000'} />
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[11px] text-muted">DDD padrão <input value={ddd} onChange={(e) => setDdd(e.target.value.replace(/\D/g, '').slice(0, 2))} className="input ml-1 w-14" /></label>
              <button type="button" className="clay ml-auto px-3 py-1 text-[11px]" disabled={pending || !texto.trim()}
                onClick={() => rodar(() => adicionarAlunos(escola.id, texto, ddd || '34'), (r) => { setTexto(''); return `${r.n ?? 0} aluno(s) na lista. ${r.ignorados?.length ? `Ignorados: ${r.ignorados.join('; ')}. ` : ''}Vínculo: ${r.info ?? ''}` })}>
                {pending ? '…' : 'Adicionar'}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="card-h">Convite pelo WhatsApp</h3>
            <p className="mt-1 text-[11px] text-fg2">
              <b>{paraConvidar.length}</b> aluno(s) sem conta e com telefone {pendentes.length - paraConvidar.length > 0 ? `(${pendentes.length - paraConvidar.length} sem telefone ou convidado há menos de 7 dias)` : ''}.
              A mensagem entra na fila do bot (tipo <code>escola</code>); o envio sai pelo WhatsApp do Duka quando você liberar com <code>!fila enviar</code>.
            </p>
            <button type="button" className="mt-2 text-[11px] underline text-muted" onClick={() => setMostrarModelo((v) => !v)}>{mostrarModelo ? 'esconder texto' : 'ver/editar texto'}</button>
            {mostrarModelo && (
              <textarea value={modeloEdit} onChange={(e) => setModeloEdit(e.target.value)} rows={10} className="input mt-2 w-full text-[11px]" />
            )}
            <button type="button" className="clay mt-2 w-full px-3 py-1.5 text-[12px]" disabled={pending || paraConvidar.length === 0 || escola.status !== 'ativa'}
              onClick={() => { if (confirm(`Colocar ${paraConvidar.length} convite(s) na fila do WhatsApp?`)) rodar(() => convidar(escola.id, modeloEdit !== modelo ? modeloEdit : null), (r) => `Na fila: ${r.info ?? ''}`) }}>
              Preparar convites ({paraConvidar.length})
            </button>
          </div>
        </div>
      </div>
      {msg && <div className="text-[11px] text-fg2">{msg}</div>}
    </div>
  )
}
