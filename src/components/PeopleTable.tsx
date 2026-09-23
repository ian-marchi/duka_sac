'use client'

import { useState } from 'react'
import type { Pessoa, Grupo } from '@/lib/analytics'
import { GRUPO_META, diffDays } from '@/lib/analytics'
import { fullNumber } from '@/lib/format'

type Col = { k: string; t: string; r?: boolean }
const COLS: Col[] = [
  { k: 'nome', t: 'Pessoa' },
  { k: 'situacao', t: 'Situação' },
  { k: 'ab', t: 'Aberturas', r: true },
  { k: 'diasAt', t: 'Dias ativos', r: true },
  { k: 'rotina', t: 'Rotina cumprida', r: true },
  { k: 'ultAb', t: 'Última abertura' },
  { k: 'ia', t: 'Chamadas IA', r: true },
  { k: 'tok', t: 'Tokens', r: true },
  { k: 'pontos', t: 'Pontos', r: true },
]
const ORDER: Grupo[] = ['habito', 'testou', 'sessao', 'nunca']

export function PeopleTable({ pessoas, hoje }: { pessoas: Pessoa[]; hoje: string }) {
  const [sort, setSort] = useState<string | null>(null)
  const max = {
    ab: Math.max(1, ...pessoas.map((p) => p.ab)),
    ia: Math.max(1, ...pessoas.map((p) => p.ia)),
    tok: Math.max(1, ...pessoas.map((p) => p.tok)),
    pontos: Math.max(1, ...pessoas.map((p) => p.pontos)),
  }
  // Sempre numérico: TS não aceita `<` entre `string | number`.
  const val = (p: Pessoa, k: string): number => {
    if (k === 'rotina') return p.esp ? p.cump / p.esp : -1
    if (k === 'ultAb') return p.ultAb ? Date.parse(`${p.ultAb}T00:00:00Z`) : 0
    if (k === 'situacao') return ORDER.length - ORDER.indexOf(p.grupo)
    return Number((p as unknown as Record<string, unknown>)[k] ?? 0)
  }

  const rows = sort
    ? [...pessoas].sort((a, b) => { const x = val(a, sort), y = val(b, sort); return x < y ? 1 : x > y ? -1 : b.ab - a.ab })
    : null

  const linha = (p: Pessoa) => {
    const g = GRUPO_META[p.grupo]
    const d = p.ultAb ? diffDays(p.ultAb, hoje) : null
    const ad = p.esp ? p.cump / p.esp : null
    const corAd = ad === null ? 'rgb(var(--border))' : ad >= 0.6 ? 'rgb(14 148 105)' : ad >= 0.3 ? 'rgb(201 130 26)' : 'rgb(200 30 99)'
    return (
      <tr key={p.id} className="border-b align-middle hover:bg-bg/60">
        <td className="py-2.5 pr-3">
          <div className="text-sm font-medium">{p.nome}</div>
          <div className="text-xs text-muted">{p.user ? `@${p.user}` : 'sem username'}{p.curso ? ` · ${p.curso.split(',')[0].trim()}` : ''}</div>
        </td>
        <td className="py-2.5 pr-3">
          <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${g.cor.replace(')', ' / 0.15)')}`, color: g.cor }}>{g.tag}</span>
          {!p.onboarding && p.diasAt > 0 && <span className="ml-1 rounded bg-p2/15 px-1.5 py-0.5 text-[11px] font-semibold text-p2">travou no onboarding</span>}
        </td>
        <td className="py-2.5 pr-3 text-right"><Mini v={p.ab} max={max.ab} cor="rgb(29 111 196)" /></td>
        <td className="py-2.5 pr-3 text-right text-sm text-muted">{p.diasAt || '—'}</td>
        <td className="py-2.5 pr-3 text-right">
          {p.esp ? (
            <span className="inline-flex items-center justify-end gap-2">
              <span className="inline-block h-1.5 w-11 overflow-hidden rounded bg-bg"><span className="block h-full rounded" style={{ width: `${(ad ?? 0) * 100}%`, background: corAd }} /></span>
              <b className="text-sm font-semibold">{p.cump} <span className="font-normal text-muted">de</span> {p.esp}</b>
            </span>
          ) : <span className="text-xs text-muted">sem rotina</span>}
        </td>
        <td className="whitespace-nowrap py-2.5 pr-3 text-sm">
          {p.ultAb ? <>{p.ultAb.slice(8)}/{p.ultAb.slice(5, 7)} <span className="ml-1 text-xs text-muted">{d === 0 ? 'hoje' : d === 1 ? 'ontem' : `${d} dias`}</span></> : <span className="text-xs text-muted">nunca</span>}
        </td>
        <td className="py-2.5 pr-3 text-right"><Mini v={p.ia} max={max.ia} cor="rgb(91 52 199)" /></td>
        <td className="py-2.5 pr-3 text-right"><Mini v={p.tok} max={max.tok} cor="rgb(155 125 224)" fmt /></td>
        <td className="py-2.5 text-right"><Mini v={p.pontos} max={max.pontos} cor="rgb(176 186 201)" fmt /></td>
      </tr>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted">
              {COLS.map((c) => (
                <th
                  key={c.k}
                  onClick={() => c.k !== 'nome' && setSort(sort === c.k ? null : c.k)}
                  className={`pb-2 pr-3 font-semibold ${c.r ? 'text-right' : ''} ${c.k !== 'nome' ? 'cursor-pointer select-none hover:text-fg' : ''} ${sort === c.k ? 'text-brand' : ''}`}
                >
                  {c.t}{sort === c.k ? ' ▾' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows ? rows.map(linha) : ORDER.map((g) => {
              const l = pessoas.filter((p) => p.grupo === g).sort((a, b) => b.ab - a.ab || b.ia - a.ia || b.pontos - a.pontos)
              if (!l.length) return null
              const m = GRUPO_META[g]
              return [
                <tr key={`g-${g}`}><td colSpan={COLS.length} className="bg-bg py-1.5 text-xs font-bold text-muted">
                  <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: m.cor }} />
                  {m.titulo} <span className="font-medium">· {l.length} {l.length === 1 ? 'pessoa' : 'pessoas'} · {m.sub}</span>
                </td></tr>,
                ...l.map(linha),
              ]
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        {sort
          ? <>Ordenado por <b>{COLS.find((c) => c.k === sort)?.t}</b>. <button className="underline" onClick={() => setSort(null)}>Voltar ao agrupamento por situação</button>.</>
          : 'Agrupado por situação, do mais engajado ao menos, e ordenado por aberturas dentro de cada grupo. Clique em qualquer coluna para reordenar.'}
      </p>
    </div>
  )
}

function Mini({ v, max, cor, fmt }: { v: number; max: number; cor: string; fmt?: boolean }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="inline-block h-2 rounded" style={{ width: `${(v / max) * 44}px`, background: cor, opacity: v ? 1 : 0 }} />
      <b className="min-w-[36px] text-sm font-semibold tabular-nums">{v ? (fmt ? fullNumber(v) : v) : '—'}</b>
    </span>
  )
}
