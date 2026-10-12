'use client'
import Link from 'next/link'
import { useCallback } from 'react'
import { useFiltroExcel, Valor, Th, FiltrosAtivos } from '@/components/FiltroExcel'
import { STATUS_META, escolaCurta, type Aluno } from '@/lib/alunos'
import type { CanalCurto } from '@/lib/aparelho'
import { PerfilPopup, type PerfilResumo } from '@/components/PerfilPopup'

/**
 * A planilha do WhatsApp com filtro tipo Excel (12/10/2026): clicar em escola,
 * ano, status, "no app" ou canal filtra. Colunas novas: canal (App Store / Play
 * Store / Beta), quando entrou no app e as datas da conversa.
 */
export type CanalConta = { key: CanalCurto; label: string }

const COLUNAS: Record<string, string> = { escola: 'Escola', ano: 'Ano', status: 'Status', app: 'No app', canal: 'Canal' }
const CANAL_COR: Record<CanalCurto, string> = { appstore: 'rgb(14 148 105)', playstore: 'rgb(14 148 105)', beta: 'rgb(var(--brand))', dev: 'rgb(var(--muted))' }
const CANAL_LABEL: Record<string, string> = { appstore: 'App Store', playstore: 'Play Store', beta: 'Beta', dev: 'Dev' }
const dm = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : null)
const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null)

export function WhatsappTabela({ alunos, total, perfis, canais }: {
  alunos: Aluno[]; total: number; perfis: Record<string, PerfilResumo>; canais: Record<string, CanalConta>
}) {
  const valor = useCallback((a: Aluno, col: string): string | number | null => {
    switch (col) {
      case 'nome': return a.nome || null
      case 'escola': return a.nome ? a.escola : null
      case 'ano': return a.nome ? a.ano : null
      case 'status': return a.status
      case 'app': return a.conta ? 'sim' : 'nao'
      case 'canal': return a.conta ? (canais[a.conta.id]?.key ?? 'sem') : null
      case 'entrou': return a.conta?.criado ?? null
      case 'primeiraMsg': return a.primeiraMsg
      case 'ultimaMsg': return a.ultimaMsg
      default: return null
    }
  }, [canais])
  const fx = useFiltroExcel(alunos, valor)
  const rotulo = (col: string, v: string) =>
    col === 'status' ? STATUS_META[v as Aluno['status']]?.label ?? v
    : col === 'app' ? (v === 'sim' ? 'já no app' : 'ainda não')
    : col === 'canal' ? (CANAL_LABEL[v] ?? 'sem canal')
    : col === 'escola' ? escolaCurta(v) : v

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-3 py-2">
        <FiltrosAtivos filtros={fx.filtros} colunas={COLUNAS} rotulo={rotulo} alternar={fx.alternar} limpar={fx.limpar} total={total} mostrados={fx.resultado.length} />
      </div>
      <div className="flex-1 overflow-auto">
        {fx.resultado.length === 0 && <div className="p-10 text-center text-sm text-muted">Ninguém com esse filtro.</div>}
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10 bg-bg text-left text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <Th col="nome" ordem={fx.ordem} onClick={fx.ordenar} className="px-3">Nome</Th>
              <Th col="escola" ordem={fx.ordem} onClick={fx.ordenar}>Escola</Th>
              <Th col="ano" ordem={fx.ordem} onClick={fx.ordenar}>Ano</Th>
              <Th col="status" ordem={fx.ordem} onClick={fx.ordenar}>Status</Th>
              <Th col="app" ordem={fx.ordem} onClick={fx.ordenar}>No app</Th>
              <Th col="canal" ordem={fx.ordem} onClick={fx.ordenar}>Canal</Th>
              <Th col="entrou" ordem={fx.ordem} onClick={fx.ordenar}>Entrou no app</Th>
              <Th col="primeiraMsg" ordem={fx.ordem} onClick={fx.ordenar}>1ª msg</Th>
              <Th col="ultimaMsg" ordem={fx.ordem} onClick={fx.ordenar}>Última msg</Th>
              <th className="px-2 py-2">Observação</th>
            </tr>
          </thead>
          <tbody>
            {fx.resultado.map((a, i) => {
              const canal = a.conta ? canais[a.conta.id] : undefined
              return (
                <tr key={`${a.contato}-${i}`} className="border-t border-borderSubtle hover:bg-surface">
                  <td className="px-3 py-1.5">
                    <div className="font-bold text-fg">{a.nome || <span className="font-normal text-muted">(sem nome)</span>}</div>
                    <div className="text-[11px] text-muted">{a.contato}</div>
                  </td>
                  <td className="px-2 py-1.5 text-fg2"><Valor col="escola" v={a.nome ? a.escola : null} rot={a.nome ? escolaCurta(a.escola) : undefined} on={fx.ativo('escola', a.escola)} onClick={fx.alternar} title={a.escolaBruta || a.escola} /></td>
                  <td className="px-2 py-1.5 text-fg2"><Valor col="ano" v={a.nome ? a.ano : null} on={fx.ativo('ano', a.ano)} onClick={fx.alternar} /></td>
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => fx.alternar('status', a.status)} title={fx.ativo('status', a.status) ? 'tirar o filtro' : 'filtrar por este status'}
                      className={`rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold text-white ${fx.ativo('status', a.status) ? 'ring-2 ring-white' : ''}`} style={{ background: STATUS_META[a.status].cor }}>
                      {STATUS_META[a.status].label.replace(' (conversa vazia)', '')}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    {a.conta ? (
                      <span className="inline-flex items-center gap-1">
                        {perfis[a.conta.id] ? <PerfilPopup p={perfis[a.conta.id]} /> : <Link href={`/alunos?u=${a.conta.id}`} className="chip chip-on">sim</Link>}
                        <Valor col="app" v="sim" rot="✓" on={fx.ativo('app', 'sim')} onClick={fx.alternar} title="filtrar: já no app" />
                      </span>
                    ) : a.nome ? <Valor col="app" v="nao" rot="ainda não" on={fx.ativo('app', 'nao')} onClick={fx.alternar} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    {a.conta
                      ? <Valor col="canal" v={canal?.key ?? 'sem'} rot={canal?.label ?? 'sem canal'} on={fx.ativo('canal', canal?.key ?? 'sem')} onClick={fx.alternar} cor={canal ? CANAL_COR[canal.key] : 'rgb(var(--muted))'} />
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-fg2" title={dmy(a.conta?.criado) ?? ''}>{dm(a.conta?.criado) ?? <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-1.5 text-fg2" title={dmy(a.primeiraMsg) ?? ''}>{dm(a.primeiraMsg) ?? <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-1.5 text-fg2" title={dmy(a.ultimaMsg) ?? ''}>{dm(a.ultimaMsg) ?? <span className="text-muted">—</span>}</td>
                  <td className="max-w-[26ch] truncate px-2 py-1.5 text-[11px] text-muted" title={a.obs}>{a.obs}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
