'use client'

import { useEffect, useRef, useState } from 'react'

// Peças pequenas dos gráficos da visão geral: número que conta, variação,
// minigráfico e medida de largura. Tudo sem biblioteca.

export type Fmt = 'int' | 'pct' | 'dec1' | 'compact' | 'usd'

export function formatar(v: number, fmt: Fmt = 'int'): string {
  switch (fmt) {
    case 'pct': return `${v.toFixed(v >= 10 || v === 0 ? 0 : 1).replace('.', ',')}%`
    case 'dec1': return v.toFixed(1).replace('.', ',')
    case 'usd': return `US$ ${v.toFixed(2)}`
    case 'compact':
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1).replace('.', ',')} mil`
      return String(Math.round(v))
    default: return Math.round(v).toLocaleString('pt-BR')
  }
}

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Número que "conta" até o valor (e de um valor ao outro quando muda). */
export function CountUp({ value, fmt = 'int', ms = 900 }: { value: number; fmt?: Fmt; ms?: number }) {
  const [v, setV] = useState(0) // começa do zero e conta até o valor na montagem
  const de = useRef(0)
  useEffect(() => {
    if (reduzMovimento()) { setV(value); de.current = value; return }
    const ini = de.current, t0 = performance.now()
    let raf = 0
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(ini + (value - ini) * e)
      if (k < 1) raf = requestAnimationFrame(passo)
      else de.current = value
    }
    raf = requestAnimationFrame(passo)
    return () => { cancelAnimationFrame(raf); de.current = value }
  }, [value, ms])
  return <>{formatar(v, fmt)}</>
}

/** Seta ▲/▼ com a variação percentual contra o período anterior. */
export function Delta({ pct, vs, inverso }: { pct: number | null; vs?: string; inverso?: boolean }) {
  if (pct === null) return <span className="text-[11px] text-muted">sem base{vs ? ` ${vs}` : ''}</span>
  const sobe = pct > 0.5, desce = pct < -0.5
  const bom = inverso ? desce : sobe
  const ruim = inverso ? sobe : desce
  const cor = bom ? 'text-ok' : ruim ? 'text-p0' : 'text-muted'
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${cor}`} title={vs}>
      {sobe ? '▲' : desce ? '▼' : '■'} {Math.abs(pct).toFixed(Math.abs(pct) >= 10 ? 0 : 1).replace('.', ',')}%
      {vs && <span className="ml-0.5 font-normal text-muted">{vs}</span>}
    </span>
  )
}

/** Largura atual de um elemento (para os SVGs responsivos). */
export function useLargura<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    setW(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** Minigráfico de área (sparkline) com o último ponto destacado. */
export function Spark({ data, cor, h = 36, destaque = true }: { data: number[]; cor: string; h?: number; destaque?: boolean }) {
  const [ref, w] = useLargura<HTMLDivElement>()
  const n = data.length
  const max = Math.max(1, ...data)
  const x = (i: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * (w - 4) + 2)
  const y = (v: number) => h - 3 - (v / max) * (h - 8)
  const linha = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const id = useRef(`sp${Math.random().toString(36).slice(2, 8)}`).current
  return (
    <div ref={ref} style={{ height: h }}>
      {w > 0 && n > 0 && (
        <svg width={w} height={h} className="overflow-visible">
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <g className="dk-reveal">
            <path d={`${linha}L${x(n - 1)},${h}L${x(0)},${h}Z`} fill={`url(#${id})`} />
            <path d={linha} fill="none" stroke={cor} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {destaque && <circle className="dk-pop" style={{ ['--d' as string]: '900ms' }} cx={x(n - 1)} cy={y(data[n - 1])} r={3} fill={cor} />}
        </svg>
      )}
    </div>
  )
}

/** Controle segmentado (Dia | Semana | Mês…). */
export function Seg<T extends string>({ value, onChange, opcoes }: { value: T; onChange: (v: T) => void; opcoes: { v: T; l: string }[] }) {
  return (
    <div className="dk-seg">
      {opcoes.map((o) => (
        <button key={o.v} type="button" data-on={o.v === value ? '1' : '0'} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  )
}
