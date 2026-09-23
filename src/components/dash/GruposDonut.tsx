'use client'

import { useState } from 'react'
import { CountUp } from './base'

export type FatiaGrupo = { chave: string; titulo: string; sub: string; cor: string; n: number; nomes: string[] }

/**
 * Rosca dos quatro grupos de comportamento. Passar o mouse destaca a fatia;
 * clicar fixa o grupo e mostra quem está nele (filtro cruzado, estilo Power BI).
 */
export function GruposDonut({ fatias, total }: { fatias: FatiaGrupo[]; total: number }) {
  const [fixo, setFixo] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const ativo = hover ?? fixo
  const sel = fatias.find((f) => f.chave === ativo) ?? null

  const R = 70, E = 22, C = 2 * Math.PI * R
  let acum = 0

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-[180px] w-[180px]">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle cx={90} cy={90} r={R} fill="none" stroke="rgb(var(--elev))" strokeWidth={E} />
          {fatias.map((f, i) => {
            const frac = total ? f.n / total : 0
            const off = acum
            acum += frac
            const on = !ativo || ativo === f.chave
            return (
              <circle
                key={f.chave} cx={90} cy={90} r={R} fill="none" stroke={f.cor}
                strokeWidth={ativo === f.chave ? E + 6 : E}
                strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`}
                strokeDashoffset={-off * C}
                opacity={on ? 1 : 0.28}
                className="dk-fade cursor-pointer transition-all duration-300"
                style={{ ['--d' as string]: `${i * 120}ms` }}
                onPointerEnter={() => setHover(f.chave)}
                onPointerLeave={() => setHover(null)}
                onClick={() => setFixo(fixo === f.chave ? null : f.chave)}
              />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-3xl font-extrabold leading-none" style={{ color: sel?.cor }}>
            <CountUp value={sel ? sel.n : total} ms={500} />
          </span>
          <span className="mt-1 max-w-[100px] text-[10px] leading-tight text-muted">{sel ? sel.titulo : 'contas na base'}</span>
          {sel && total > 0 && <span className="text-[11px] font-bold text-fg2">{Math.round((sel.n / total) * 100)}%</span>}
        </div>
      </div>

      <div className="min-w-0">
        <div className="space-y-1.5">
          {fatias.map((f) => (
            <button
              key={f.chave} type="button"
              onPointerEnter={() => setHover(f.chave)} onPointerLeave={() => setHover(null)}
              onClick={() => setFixo(fixo === f.chave ? null : f.chave)}
              className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs transition ${fixo === f.chave ? 'border-brand bg-brandSoft' : 'border-transparent hover:bg-elev'}`}
            >
              <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.cor }} />
              <span className="min-w-0 flex-1"><b className="text-fg">{f.titulo}</b> <span className="text-muted">· {f.sub}</span></span>
              <b className="font-display text-sm" style={{ color: f.cor }}>{f.n}</b>
            </button>
          ))}
        </div>
        {fixo && sel && (
          <div className="dk-fade-up mt-2 flex max-h-28 flex-wrap gap-1 overflow-auto rounded-xl bg-bg/60 p-2">
            {sel.nomes.length ? sel.nomes.map((n, i) => <span key={i} className="rounded-full bg-elev px-2 py-0.5 text-[11px] text-fg2">{n}</span>) : <span className="text-[11px] text-muted">ninguém</span>}
          </div>
        )}
        {!fixo && <p className="mt-2 text-[11px] text-muted">Clique num grupo para ver quem está nele.</p>}
      </div>
    </div>
  )
}
