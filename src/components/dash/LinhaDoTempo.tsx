'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays } from '@/lib/analytics'
import {
  type Bruto, type Gran, type Metrica, METRICA_META, indexar, baldes, resumo, anterior, variacao, granPadrao, dm,
} from '@/lib/serieTempo'
import { CountUp, Delta, Seg, useLargura, formatar } from './base'

const H = 260
const PAD = { t: 14, r: 12, b: 24, l: 38 }

function tetoBonito(v: number): number {
  if (v <= 4) return 4
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p
  return 10 * p
}

/**
 * Gráfico principal da visão geral (estilo Power BI): métrica × granularidade,
 * área ou colunas, linha da média, comparação com o período anterior,
 * tooltip ao passar o mouse e seleção por arraste — a seleção mostra o resumo
 * do trecho e pode virar o filtro do painel inteiro.
 */
export function LinhaDoTempo({ bruto, de: deFiltro, ate }: { bruto: Bruto; de: string; ate: string }) {
  // período de um dia só (Diário): o gráfico mostra os 14 dias até ele, com o dia em destaque
  const umDia = deFiltro === ate
  const de = umDia ? addDays(ate, -13) : deFiltro
  const router = useRouter()
  const sp = useSearchParams()
  const ix = useMemo(() => indexar(bruto), [bruto])
  const [m, setM] = useState<Metrica>('ativos')
  const [g, setG] = useState<Gran>(() => granPadrao(de, ate))
  // período novo no filtro → granularidade que faz sentido para ele
  useEffect(() => { setG(granPadrao(de, ate)); setSel(null) }, [de, ate])
  const [tipo, setTipo] = useState<'area' | 'colunas'>('area')
  const [comparar, setComparar] = useState(true)
  const [hover, setHover] = useState<number | null>(null)
  const [sel, setSel] = useState<[number, number] | null>(null)
  const arraste = useRef<number | null>(null)
  const [ref, w] = useLargura<HTMLDivElement>()

  const ant = anterior(deFiltro, ate)
  const serie = useMemo(() => baldes(ix, de, ate, g), [ix, de, ate, g])
  const antGraf = anterior(de, ate)
  const serieAnt = useMemo(() => baldes(ix, antGraf.de, antGraf.ate, g), [ix, antGraf.de, antGraf.ate, g])
  const total = useMemo(() => resumo(ix, deFiltro, ate), [ix, deFiltro, ate])
  const totalAnt = useMemo(() => resumo(ix, ant.de, ant.ate), [ix, ant.de, ant.ate])
  const meta = METRICA_META[m]

  const vals = serie.map((b) => b[m])
  const valsAnt = serieAnt.map((b) => b[m])
  const n = vals.length
  const media = n ? vals.reduce((s, v) => s + v, 0) / n : 0
  const picoI = vals.reduce((mi, v, i) => (v > vals[mi] ? i : mi), 0)
  const max = tetoBonito(Math.max(1, ...vals, ...(comparar ? valsAnt.slice(0, n) : [])))

  const pw = Math.max(0, w - PAD.l - PAD.r)
  const ph = H - PAD.t - PAD.b
  const passo = n ? pw / n : 0
  const cx = (i: number) => PAD.l + passo * (i + 0.5)
  const cy = (v: number) => PAD.t + ph - (v / max) * ph
  const linha = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join('')
  const idxDoX = (x: number) => Math.max(0, Math.min(n - 1, Math.floor((x - PAD.l) / (passo || 1))))
  const cada = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 56))))
  const chaveAnim = `${m}-${g}-${tipo}-${de}-${ate}`

  const selRes = sel ? resumo(ix, serie[Math.min(...sel)].inicio, serie[Math.max(...sel)].fim) : null
  function filtrarPainel() {
    if (!sel) return
    const q = new URLSearchParams(sp.toString())
    q.delete('p'); q.set('de', serie[Math.min(...sel)].inicio); q.set('ate', serie[Math.max(...sel)].fim)
    router.push(`/?${q.toString()}`, { scroll: false })
    setSel(null)
  }

  const eventoX = (e: React.PointerEvent<SVGSVGElement>) => e.clientX - e.currentTarget.getBoundingClientRect().left
  const b = hover !== null ? serie[hover] : null

  return (
    <section className="dk-tile">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="dk-h">{meta.label} ao longo do tempo{umDia && <span className="ml-2 text-[11px] font-normal text-muted">dia {dm(ate)} em destaque · 14 dias de contexto</span>}</h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-2xl font-extrabold" style={{ color: meta.cor }}><CountUp value={total[m]} /></span>
            <Delta pct={variacao(total[m], totalAnt[m])} vs={`vs ${dm(ant.de)}–${dm(ant.ate)}`} />
            <span className="text-[11px] text-muted">média <b className="text-fg2">{formatar(media, 'dec1')}</b> por {g === 'dia' ? 'dia' : g === 'semana' ? 'semana' : 'mês'}</span>
            {n > 0 && <span className="text-[11px] text-muted">pico <b className="text-fg2">{vals[picoI]}</b> em {serie[picoI].rotulo}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg value={m} onChange={(v) => { setM(v); setSel(null) }} opcoes={[{ v: 'ativos', l: 'Entraram' }, { v: 'aberturas', l: 'Aberturas' }, { v: 'novos', l: 'Cadastros' }]} />
          <Seg value={g} onChange={(v) => { setG(v); setSel(null) }} opcoes={[{ v: 'dia', l: 'Dia' }, { v: 'semana', l: 'Semana' }, { v: 'mes', l: 'Mês' }]} />
          <Seg value={tipo} onChange={setTipo} opcoes={[{ v: 'area', l: 'Área' }, { v: 'colunas', l: 'Colunas' }]} />
          <button type="button" onClick={() => setComparar(!comparar)} className={`chip ${comparar ? 'chip-on' : ''}`} title="Sobrepõe o período anterior de mesmo tamanho">
            ⇆ anterior
          </button>
        </div>
      </div>

      <div ref={ref} className="relative mt-3 select-none" style={{ height: H }}>
        {w > 0 && (
          <svg
            width={w} height={H} className="touch-none"
            onPointerMove={(e) => {
              const i = idxDoX(eventoX(e)); setHover(i)
              if (arraste.current !== null) setSel([arraste.current, i])
            }}
            onPointerLeave={() => { setHover(null); arraste.current = null }}
            onPointerDown={(e) => { const i = idxDoX(eventoX(e)); arraste.current = i; setSel(null) }}
            onPointerUp={(e) => {
              const i = idxDoX(eventoX(e))
              if (arraste.current !== null && arraste.current !== i) setSel([arraste.current, i])
              arraste.current = null
            }}
          >
            <defs>
              <linearGradient id="lt-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={meta.cor} stopOpacity={0.45} />
                <stop offset="100%" stopColor={meta.cor} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* grade + eixo Y */}
            {[0, 0.25, 0.5, 0.75, 1].map((k) => (
              <g key={k}>
                <line x1={PAD.l} x2={w - PAD.r} y1={cy(max * k)} y2={cy(max * k)} stroke="rgb(var(--border))" strokeDasharray={k ? '3 4' : undefined} />
                <text x={PAD.l - 6} y={cy(max * k) + 3.5} textAnchor="end" className="fill-muted text-[10px]">{formatar(max * k, 'compact')}</text>
              </g>
            ))}

            {/* dia do filtro Diário em destaque */}
            {umDia && n > 0 && (
              <rect x={PAD.l + passo * (n - 1)} width={passo} y={PAD.t} height={ph} fill="rgb(var(--brand) / .10)" rx={6} />
            )}

            {/* seleção por arraste */}
            {sel && (
              <rect x={PAD.l + passo * Math.min(...sel)} width={passo * (Math.abs(sel[1] - sel[0]) + 1)} y={PAD.t} height={ph}
                fill="rgb(var(--brand) / .12)" stroke="rgb(var(--brand) / .5)" strokeDasharray="4 3" rx={6} />
            )}

            <g key={chaveAnim}>
              {tipo === 'area' ? (
                <g className="dk-reveal">
                  <path d={`${linha(vals)}L${cx(n - 1)},${cy(0)}L${cx(0)},${cy(0)}Z`} fill="url(#lt-grad)" />
                  <path d={linha(vals)} fill="none" stroke={meta.cor} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              ) : (
                vals.map((v, i) => {
                  const bw = Math.max(2, passo * 0.68)
                  const on = hover === i || (sel && i >= Math.min(...sel) && i <= Math.max(...sel))
                  return (
                    <rect key={i} className="dk-rise" style={{ ['--d' as string]: `${Math.min(i * 18, 600)}ms` }}
                      x={cx(i) - bw / 2} y={cy(v)} width={bw} height={Math.max(0, cy(0) - cy(v))} rx={Math.min(5, bw / 3)}
                      fill={meta.cor} opacity={hover === null && !sel ? 0.85 : on ? 1 : 0.4} />
                  )
                })
              )}
              {comparar && valsAnt.length > 0 && (
                <path className="dk-fade" style={{ ['--d' as string]: '500ms' }} d={linha(valsAnt.slice(0, n))} fill="none"
                  stroke="rgb(var(--fg2))" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 4" />
              )}
              {n > 0 && (
                <g className="dk-fade" style={{ ['--d' as string]: '700ms' }}>
                  <line x1={PAD.l} x2={w - PAD.r} y1={cy(media)} y2={cy(media)} stroke={meta.cor} strokeOpacity={0.6} strokeDasharray="1 4" strokeWidth={2} strokeLinecap="round" />
                  <text x={w - PAD.r} y={cy(media) - 5} textAnchor="end" className="text-[10px] font-bold" fill={meta.cor}>média</text>
                </g>
              )}
              {tipo === 'area' && n > 0 && (
                <circle className="dk-pop" style={{ ['--d' as string]: '1000ms' }} cx={cx(picoI)} cy={cy(vals[picoI])} r={4.5} fill={meta.cor} stroke="rgb(var(--surface))" strokeWidth={2} />
              )}
            </g>

            {/* eixo X */}
            {serie.map((s, i) => (i % cada === 0 ? (
              <text key={s.chave} x={cx(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">{s.rotulo}</text>
            ) : null))}

            {/* hover */}
            {hover !== null && b && (
              <g pointerEvents="none">
                <line x1={cx(hover)} x2={cx(hover)} y1={PAD.t} y2={PAD.t + ph} stroke="rgb(var(--fg2) / .4)" />
                <circle cx={cx(hover)} cy={cy(vals[hover])} r={5} fill={meta.cor} stroke="rgb(var(--surface))" strokeWidth={2} />
                {comparar && valsAnt[hover] !== undefined && <circle cx={cx(hover)} cy={cy(valsAnt[hover])} r={3.5} fill="rgb(var(--fg2))" />}
              </g>
            )}
          </svg>
        )}

        {hover !== null && b && (
          <div
            className="pointer-events-none absolute z-10 w-52 rounded-xl border bg-elev/95 p-2.5 text-xs shadow-xl backdrop-blur"
            style={{ left: Math.min(Math.max(cx(hover) + 12, 0), Math.max(0, w - 216)), top: 8 }}
          >
            <div className="mb-1 font-display font-bold capitalize">{b.titulo}</div>
            {(['ativos', 'aberturas', 'novos'] as Metrica[]).map((k) => (
              <div key={k} className={`flex justify-between gap-2 ${k === m ? 'font-bold text-fg' : 'text-fg2'}`}>
                <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: METRICA_META[k].cor }} />{METRICA_META[k].curto}</span>
                <span>{b[k]}</span>
              </div>
            ))}
            {comparar && serieAnt[hover] && (
              <div className="mt-1 border-t pt-1 text-[11px] text-muted">
                antes ({serieAnt[hover].rotulo}): <b className="text-fg2">{serieAnt[hover][m]}</b>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex min-h-8 flex-wrap items-center gap-2 text-xs">
        {sel && selRes ? (
          <div className="dk-fade-up flex flex-wrap items-center gap-2 rounded-xl border border-brand/40 bg-brandSoft px-3 py-1.5">
            <span className="font-bold">{serie[Math.min(...sel)].inicio.split('-').reverse().join('/')} → {serie[Math.max(...sel)].fim.split('-').reverse().join('/')}</span>
            <span className="text-fg2"><b className="text-fg">{selRes.ativos}</b> entraram · <b className="text-fg">{selRes.aberturas}</b> aberturas · <b className="text-fg">{selRes.novos}</b> cadastros</span>
            <button type="button" onClick={filtrarPainel} className="rounded-lg bg-brand px-2.5 py-1 font-bold text-white hover:opacity-90">Filtrar o painel</button>
            <button type="button" onClick={() => setSel(null)} className="text-muted hover:text-fg">limpar</button>
          </div>
        ) : (
          <span className="text-muted">Dica: arraste sobre o gráfico para somar um trecho e filtrar o painel por ele.</span>
        )}
        {comparar && <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted"><i className="inline-block w-4 border-t-2 border-dashed border-fg2/60" /> período anterior ({dm(antGraf.de)}–{dm(antGraf.ate)})</span>}
      </div>
    </section>
  )
}
