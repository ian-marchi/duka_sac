'use client'
import Link from 'next/link'
import { useCallback } from 'react'
import { useFiltroExcel, Valor, Th, FiltrosAtivos } from '@/components/FiltroExcel'
import { STATUS_META, type StatusAluno } from '@/lib/alunos'
import type { CanalCurto } from '@/lib/aparelho'

/**
 * Tabela das contas do app com a cara da planilha do WhatsApp (pedido do Ian,
 * 12/10/2026): escola, ano, canal (App Store / Play Store / Beta / Dev), o que
 * aconteceu no WhatsApp, quando entrou no app, quando recebeu a 1ª mensagem e o
 * último aviso, último uso. Cada valor é clicável e filtra como no Excel.
 */
export type LinhaAluno = {
  id: string
  nome: string
  user: string | null
  escola: string | null
  escolaCurta: string | null
  ano: string | null
  canal: CanalCurto | null
  canalLabel: string | null
  /** Situação no WhatsApp: respondeu / não respondeu / sem dados / fora (não veio pelo WhatsApp). */
  ws: StatusAluno | 'fora'
  /** Conta criada (YYYY-MM-DD). */
  entrou: string
  /** Primeira mensagem na conversa do WhatsApp (YYYY-MM-DD), do scan. */
  primeiraMsg: string | null
  /** Último aviso que o bot mandou pra essa conta (YYYY-MM-DD). */
  aviso: string | null
  ultAb: string | null
  diasAt: number
  grupo: string
  grupoTag: string
  grupoCor: string
  pontos: number
  onboarding: boolean
  /** Minutos dentro do app nos últimos 7 e 30 dias (migration 132; 0 em versão antiga do app). */
  min7: number
  min30: number
}

const COLUNAS: Record<string, string> = { escola: 'Escola', ano: 'Ano', canal: 'Canal', ws: 'WhatsApp', grupo: 'Grupo', onboarding: 'Cadastro' }
const WS_LABEL: Record<LinhaAluno['ws'], string> = { respondeu: 'Respondeu', nao_respondeu: 'Não respondeu', sem_dados: 'Sem dados', fora: 'Fora do WhatsApp' }
const WS_COR: Record<LinhaAluno['ws'], string> = { respondeu: STATUS_META.respondeu.cor, nao_respondeu: STATUS_META.nao_respondeu.cor, sem_dados: 'rgb(var(--muted))', fora: 'rgb(var(--fg2))' }
const CANAL_COR: Record<CanalCurto, string> = { appstore: 'rgb(14 148 105)', playstore: 'rgb(14 148 105)', beta: 'rgb(var(--brand))', dev: 'rgb(var(--muted))' }

const dm = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : null)
const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null)
/** 95 → "1h35", 12 → "12min", 0 → "—". */
const fmtMin = (m: number) => (m <= 0 ? null : m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`)
const diasDesde = (iso: string | null, hoje: string) => (iso ? Math.round((Date.parse(hoje) - Date.parse(iso.slice(0, 10))) / 86_400_000) : null)

export function AlunosTabela({ linhas, selected, hoje, buscaInicial = '' }: { linhas: LinhaAluno[]; selected: string | null; hoje: string; buscaInicial?: string }) {
  const valor = useCallback((l: LinhaAluno, col: string): string | number | null => {
    switch (col) {
      case 'nome': return l.user ? `@${l.user}` : l.nome
      case 'escola': return l.escola
      case 'ano': return l.ano
      case 'canal': return l.canal
      case 'ws': return l.ws
      case 'entrou': return l.entrou
      case 'primeiraMsg': return l.primeiraMsg
      case 'aviso': return l.aviso
      case 'ultAb': return l.ultAb
      case 'diasAt': return l.diasAt
      case 'grupo': return l.grupo
      case 'pontos': return l.pontos
      case 'min7': return l.min7
      case 'min30': return l.min30
      case 'onboarding': return l.onboarding ? 'completo' : 'incompleto'
      default: return null
    }
  }, [])
  const fx = useFiltroExcel(linhas, valor)
  const busca = fx.busca || buscaInicial
  const nb = busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const mostradas = nb
    ? fx.resultado.filter((l) => `${l.nome} ${l.user ?? ''} ${l.escola ?? ''} ${l.ano ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(nb))
    : fx.resultado

  const rotulo = (col: string, v: string) => col === 'ws' ? WS_LABEL[v as LinhaAluno['ws']] ?? v : col === 'canal' ? ({ appstore: 'App Store', playstore: 'Play Store', beta: 'Beta', dev: 'Dev' } as Record<string, string>)[v] ?? v : col === 'grupo' ? (linhas.find((l) => l.grupo === v)?.grupoTag ?? v) : v
  const href = (id: string) => `/alunos?u=${id}`

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-2">
          <input value={fx.busca} onChange={(e) => fx.setBusca(e.target.value)} placeholder="Nome, usuário, escola, ano…" className="input" />
        </div>
        <FiltrosAtivos filtros={fx.filtros} colunas={COLUNAS} rotulo={rotulo} alternar={fx.alternar} limpar={fx.limpar} total={linhas.length} mostrados={mostradas.length} />
      </div>
      <div className="flex-1 overflow-auto">
        {mostradas.length === 0 && <div className="p-10 text-center text-sm text-muted">Ninguém com esse filtro.</div>}
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10 bg-bg text-left text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <Th col="nome" ordem={fx.ordem} onClick={fx.ordenar} className="px-3">Aluno</Th>
              <Th col="escola" ordem={fx.ordem} onClick={fx.ordenar}>Escola</Th>
              <Th col="ano" ordem={fx.ordem} onClick={fx.ordenar}>Ano</Th>
              <Th col="canal" ordem={fx.ordem} onClick={fx.ordenar}>Canal</Th>
              <Th col="ws" ordem={fx.ordem} onClick={fx.ordenar}>WhatsApp</Th>
              <Th col="entrou" ordem={fx.ordem} onClick={fx.ordenar}>Entrou no app</Th>
              <Th col="primeiraMsg" ordem={fx.ordem} onClick={fx.ordenar}>1ª msg</Th>
              <Th col="aviso" ordem={fx.ordem} onClick={fx.ordenar}>Último aviso</Th>
              <Th col="ultAb" ordem={fx.ordem} onClick={fx.ordenar}>Último uso</Th>
              <Th col="min7" ordem={fx.ordem} onClick={fx.ordenar}>Tempo 7d</Th>
              <Th col="grupo" ordem={fx.ordem} onClick={fx.ordenar}>Grupo</Th>
            </tr>
          </thead>
          <tbody>
            {mostradas.map((l) => {
              const on = l.id === selected
              const d = diasDesde(l.ultAb, hoje)
              return (
                <tr key={l.id} className={`border-t border-borderSubtle ${on ? 'bg-elev' : 'hover:bg-surface'}`}>
                  <td className="px-3 py-1.5">
                    <Link href={href(l.id)} scroll={false} className="block">
                      <div className={`truncate font-bold ${on ? 'text-brandText' : 'text-fg'}`}>{l.user ? `@${l.user}` : l.nome}</div>
                      <div className="truncate text-[11px] text-muted">{l.user ? l.nome : ''}{!l.onboarding ? <span className="text-p1"> · cadastro incompleto</span> : ''}</div>
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-fg2"><Valor col="escola" v={l.escola} rot={l.escolaCurta ?? undefined} on={fx.ativo('escola', l.escola ?? '')} onClick={fx.alternar} title={l.escola ?? undefined} /></td>
                  <td className="px-2 py-1.5 text-fg2"><Valor col="ano" v={l.ano} on={fx.ativo('ano', l.ano ?? '')} onClick={fx.alternar} /></td>
                  <td className="px-2 py-1.5"><Valor col="canal" v={l.canal} rot={l.canalLabel ?? undefined} on={fx.ativo('canal', l.canal ?? '')} onClick={fx.alternar} cor={l.canal ? CANAL_COR[l.canal] : undefined} /></td>
                  <td className="px-2 py-1.5"><Valor col="ws" v={l.ws} rot={WS_LABEL[l.ws]} on={fx.ativo('ws', l.ws)} onClick={fx.alternar} cor={WS_COR[l.ws]} /></td>
                  <td className="px-2 py-1.5 text-fg2" title={dmy(l.entrou) ?? ''}>{dm(l.entrou)}</td>
                  <td className="px-2 py-1.5 text-fg2" title={dmy(l.primeiraMsg) ?? 'não veio pelo WhatsApp'}>{dm(l.primeiraMsg) ?? <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-1.5 text-fg2" title={dmy(l.aviso) ?? 'nenhum aviso enviado'}>{dm(l.aviso) ?? <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-1.5 text-fg2" title={l.ultAb ? `${dmy(l.ultAb)} · ${l.diasAt} dias no período` : 'nunca abriu'}>
                    {d === null ? <span className="text-muted">nunca</span> : d === 0 ? 'hoje' : d === 1 ? 'ontem' : <span className={d >= 7 ? 'text-p0' : ''}>{`há ${d}d`}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-fg2" title={`${fmtMin(l.min7) ?? '0'} nos últimos 7 dias · ${fmtMin(l.min30) ?? '0'} nos últimos 30`}>
                    {fmtMin(l.min7) ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => fx.alternar('grupo', l.grupo)} title={fx.ativo('grupo', l.grupo) ? 'tirar o filtro' : 'filtrar por este grupo'}
                      className={`rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold text-white ${fx.ativo('grupo', l.grupo) ? 'ring-2 ring-white' : ''}`} style={{ background: l.grupoCor }}>
                      {l.grupoTag}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
