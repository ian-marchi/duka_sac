'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const PRESETS: { p: string; l: string }[] = [
  { p: '1d', l: 'Diário' }, { p: '7d', l: '7d' }, { p: '14d', l: '14d' }, { p: '30d', l: '30d' }, { p: '90d', l: '90d' },
]

/**
 * Barra de filtro da visão geral: períodos prontos, intervalo personalizado
 * (de/até), contas de teste e atualização — manual ou automática a cada
 * minuto (a preferência fica no navegador).
 */
export function FiltroPeriodo({ periodo, de, ate, hoje, showAll, hidden }: {
  periodo: string | null
  de: string
  ate: string
  hoje: string
  showAll: boolean
  hidden: number
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, start] = useTransition()
  const [abrir, setAbrir] = useState(!periodo)
  const [d1, setD1] = useState(de)
  const [d2, setD2] = useState(ate)
  const [auto, setAuto] = useState(false)
  const [quando, setQuando] = useState(() => Date.now())
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => { setD1(de); setD2(ate) }, [de, ate])
  useEffect(() => { try { setAuto(localStorage.getItem('dash-auto') === '1') } catch {} }, [])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 5000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => atualizar(), 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])

  function ir(params: Record<string, string | null>) {
    const q = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(params)) { if (v === null) q.delete(k); else q.set(k, v) }
    start(() => router.push(`/?${q.toString()}`, { scroll: false }))
  }
  function atualizar() { start(() => { router.refresh(); setQuando(Date.now()) }) }
  function alternarAuto() {
    const v = !auto; setAuto(v)
    try { localStorage.setItem('dash-auto', v ? '1' : '0') } catch {}
  }

  const seg = Math.round((agora - quando) / 1000)
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-bg/85 px-4 py-2.5 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="dk-seg">
          {PRESETS.map((p) => (
            <button key={p.p} type="button" data-on={periodo === p.p ? '1' : '0'} onClick={() => { setAbrir(false); ir({ p: p.p, de: null, ate: null }) }}>{p.l}</button>
          ))}
          <button type="button" data-on={!periodo ? '1' : '0'} onClick={() => setAbrir(!abrir)}>📅 intervalo</button>
        </div>
        {abrir && (
          <form
            className="dk-fade-up flex flex-wrap items-center gap-1.5 text-xs"
            onSubmit={(e) => { e.preventDefault(); if (d1 && d2 && d1 <= d2) ir({ p: null, de: d1, ate: d2 }) }}
          >
            <input type="date" value={d1} max={d2 || hoje} onChange={(e) => setD1(e.target.value)} className="h-8 rounded-lg border bg-surface px-2 text-xs outline-none focus:border-brand" />
            <span className="text-muted">até</span>
            <input type="date" value={d2} min={d1} max={hoje} onChange={(e) => setD2(e.target.value)} className="h-8 rounded-lg border bg-surface px-2 text-xs outline-none focus:border-brand" />
            <button type="submit" disabled={!d1 || !d2 || d1 > d2} className="h-8 rounded-lg bg-brand px-3 font-bold text-white disabled:opacity-50">Aplicar</button>
          </form>
        )}
        <span className="text-xs text-muted">{de.split('-').reverse().join('/')} → {ate.split('-').reverse().join('/')}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {(hidden > 0 || showAll) && (
            <button type="button" onClick={() => ir({ todos: showAll ? null : '1' })} className="chip">
              {showAll ? 'Ocultar contas de teste' : `Mostrar ${hidden} de teste`}
            </button>
          )}
          <button type="button" onClick={alternarAuto} className={`chip ${auto ? 'chip-on' : ''}`} title="Recarrega os dados a cada minuto">
            <i className={`inline-block h-1.5 w-1.5 rounded-full ${auto ? 'dk-pulse bg-ok' : 'bg-muted'}`} /> ao vivo
          </button>
          <button type="button" onClick={atualizar} className="chip" title="Atualizar agora">
            <span className={pending ? 'inline-block animate-spin' : ''}>↻</span>
            {pending ? 'atualizando' : seg < 10 ? 'agora' : seg < 60 ? `há ${seg}s` : `há ${Math.floor(seg / 60)} min`}
          </button>
        </div>
      </div>
    </div>
  )
}
