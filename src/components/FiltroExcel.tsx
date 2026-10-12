'use client'
import { useMemo, useState } from 'react'

/**
 * Filtro "tipo Excel" pras tabelas do painel (pedido do Ian, 12/10/2026): clicar
 * num valor de uma coluna (escola, ano, status, canal…) filtra a tabela por ele;
 * clicar de novo tira; valores da mesma coluna somam (OU), colunas diferentes
 * cruzam (E). Os filtros ativos viram chips com × em cima da tabela, e o
 * cabeçalho ordena ao clicar.
 *
 * Tudo no navegador: as páginas já mandam todas as linhas, e são centenas, não
 * milhares. A busca também é local.
 */

export type Filtros = Record<string, string[]>
export type Ordem = { col: string; dir: 'asc' | 'desc' } | null

export function useFiltroExcel<T>(linhas: T[], valor: (l: T, col: string) => string | number | null | undefined) {
  const [filtros, setFiltros] = useState<Filtros>({})
  const [ordem, setOrdem] = useState<Ordem>(null)
  const [busca, setBusca] = useState('')

  const alternar = (col: string, v: string) => setFiltros((f) => {
    const atual = f[col] ?? []
    const prox = atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v]
    const n = { ...f, [col]: prox }
    if (!prox.length) delete n[col]
    return n
  })
  const limpar = () => { setFiltros({}); setBusca('') }
  const ordenar = (col: string) => setOrdem((o) => (o?.col === col ? (o.dir === 'asc' ? { col, dir: 'desc' } : null) : { col, dir: 'asc' }))
  const ativo = (col: string, v: string) => (filtros[col] ?? []).includes(v)

  const resultado = useMemo(() => {
    let r = linhas.filter((l) => Object.entries(filtros).every(([col, vs]) => vs.includes(String(valor(l, col) ?? ''))))
    if (ordem) {
      const { col, dir } = ordem
      r = [...r].sort((a, b) => {
        const x = valor(a, col), y = valor(b, col)
        if (x == null && y == null) return 0
        if (x == null) return 1
        if (y == null) return -1
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')
        return dir === 'asc' ? c : -c
      })
    }
    return r
  }, [linhas, filtros, ordem, valor])

  return { filtros, ordem, busca, setBusca, alternar, limpar, ordenar, ativo, resultado, nFiltros: Object.keys(filtros).length }
}

/** Um valor clicável dentro da célula. Ativo = chip roxo; o resto parece texto com sublinhado pontilhado ao passar. */
export function Valor({ col, v, rot, on, onClick, cor, title }: {
  col: string; v: string | null | undefined; rot?: string; on: boolean; onClick: (col: string, v: string) => void; cor?: string; title?: string
}) {
  if (v == null || v === '') return <span className="text-muted">—</span>
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(col, v) }}
      title={title ?? (on ? `tirar o filtro ${rot ?? v}` : `filtrar por ${rot ?? v}`)}
      className={`inline-block max-w-full truncate rounded-md px-1 py-0.5 text-left align-middle transition ${on ? 'bg-brand font-bold text-white' : 'hover:bg-elev hover:underline hover:decoration-dotted'}`}
      style={!on && cor ? { color: cor } : undefined}
    >
      {rot ?? v}
    </button>
  )
}

/** Cabeçalho clicável que ordena (▲ ▼). */
export function Th({ col, children, ordem, onClick, className = '' }: { col: string; children: React.ReactNode; ordem: Ordem; onClick: (col: string) => void; className?: string }) {
  const on = ordem?.col === col
  return (
    <th className={`cursor-pointer select-none whitespace-nowrap px-2 py-2 hover:text-fg ${on ? 'text-fg' : ''} ${className}`} onClick={() => onClick(col)} title="ordenar">
      {children}{on ? (ordem!.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  )
}

/** Chips dos filtros ativos + limpar. `rotulo(col, v)` traduz o valor cru pro que a pessoa leu na tabela. */
export function FiltrosAtivos({ filtros, colunas, rotulo, alternar, limpar, total, mostrados }: {
  filtros: Filtros; colunas: Record<string, string>; rotulo?: (col: string, v: string) => string
  alternar: (col: string, v: string) => void; limpar: () => void; total: number; mostrados: number
}) {
  const pares = Object.entries(filtros).flatMap(([col, vs]) => vs.map((v) => ({ col, v })))
  if (!pares.length) return <div className="text-[11px] text-muted">{mostrados} de {total} · clique num valor da tabela pra filtrar, no cabeçalho pra ordenar</div>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted">{mostrados} de {total}</span>
      {pares.map(({ col, v }) => (
        <button key={`${col}:${v}`} type="button" onClick={() => alternar(col, v)} className="chip chip-on" title="tirar este filtro">
          <span className="text-[10px] opacity-80">{colunas[col] ?? col}:</span> {rotulo ? rotulo(col, v) : v} ×
        </button>
      ))}
      <button type="button" onClick={limpar} className="chip">limpar</button>
    </div>
  )
}
