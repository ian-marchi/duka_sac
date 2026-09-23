'use client'

import { useMemo, useState } from 'react'
import { addDays } from '@/lib/analytics'
import { type Bruto, type Metrica, METRICA_META, indexar, inicioBalde, dmy, dow } from '@/lib/serieTempo'
import { Seg, useLargura } from './base'

const SEMANAS = 16
const LINHAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/**
 * Mapa de calor das últimas 16 semanas (coluna = semana, linha = dia da
 * semana), com a média por dia da semana embaixo — mostra em que dias o
 * pessoal costuma entrar.
 */
export function Calendario({ bruto, hoje }: { bruto: Bruto; hoje: string }) {
  const ix = useMemo(() => indexar(bruto), [bruto])
  const [m, setM] = useState<Metrica>('ativos')
  const [hover, setHover] = useState<{ dia: string; v: number; x: number; y: number } | null>(null)
  const [ref, w] = useLargura<HTMLDivElement>()
  const meta = METRICA_META[m]

  const ini = addDays(inicioBalde(hoje, 'semana'), -7 * (SEMANAS - 1))
  const valor = (dia: string) => {
    if (m === 'novos') return ix.novos.get(dia) ?? 0
    const x = ix.porDia.get(dia)
    return x ? (m === 'ativos' ? new Set(x.u).size : x.ab) : 0
  }
  const cels = useMemo(() => {
    const out: { dia: string; v: number; c: number; l: number }[] = []
    for (let c = 0; c < SEMANAS; c++) for (let l = 0; l < 7; l++) {
      const dia = addDays(ini, c * 7 + l)
      if (dia <= hoje) out.push({ dia, v: valor(dia), c, l })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ix, ini, hoje, m])
  const max = Math.max(1, ...cels.map((x) => x.v))

  // média por dia da semana dentro da janela
  const porDow = LINHAS.map((_, l) => {
    const xs = cels.filter((x) => x.l === l)
    return xs.length ? xs.reduce((s, x) => s + x.v, 0) / xs.length : 0
  })
  const maxDow = Math.max(0.01, ...porDow)
  const melhor = porDow.indexOf(Math.max(...porDow))

  const esq = 28, topo = 16
  const gap = 3
  const tam = w ? Math.max(8, Math.min(22, Math.floor((w - esq) / SEMANAS) - gap)) : 0

  return (
    <section className="dk-tile">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="dk-h">Em que dias o pessoal entra</h2>
          <p className="kicker">últimas {SEMANAS} semanas · quanto mais forte, mais {meta.curto}</p>
        </div>
        <Seg value={m} onChange={setM} opcoes={[{ v: 'ativos', l: 'Entraram' }, { v: 'aberturas', l: 'Aberturas' }, { v: 'novos', l: 'Cadastros' }]} />
      </div>

      <div ref={ref} className="relative">
        {tam > 0 && (
          <svg width={w} height={topo + 7 * (tam + gap)} onPointerLeave={() => setHover(null)}>
            {LINHAS.map((d, l) => (l % 2 === 0 ? (
              <text key={d} x={0} y={topo + l * (tam + gap) + tam * 0.75} className="fill-muted text-[9px]">{d}</text>
            ) : null))}
            {Array.from({ length: SEMANAS }, (_, c) => {
              const dia = addDays(ini, c * 7)
              const novoMes = c === 0 || dia.slice(5, 7) !== addDays(dia, -7).slice(5, 7)
              return novoMes ? <text key={c} x={esq + c * (tam + gap)} y={10} className="fill-muted text-[9px]">{MES[Number(dia.slice(5, 7)) - 1]}</text> : null
            })}
            {cels.map((x) => {
              const k = x.v / max
              return (
                <rect
                  key={`${m}-${x.dia}`} className="dk-pop" style={{ ['--d' as string]: `${x.c * 25 + x.l * 8}ms` }}
                  x={esq + x.c * (tam + gap)} y={topo + x.l * (tam + gap)} width={tam} height={tam} rx={3}
                  fill={x.v ? meta.cor : 'rgb(var(--elev))'} fillOpacity={x.v ? 0.18 + 0.82 * k : 1}
                  stroke={x.dia === hoje ? 'rgb(var(--fg))' : 'none'} strokeWidth={1.5}
                  onPointerEnter={() => setHover({ dia: x.dia, v: x.v, x: esq + x.c * (tam + gap), y: topo + x.l * (tam + gap) })}
                />
              )
            })}
          </svg>
        )}
        {hover && (
          <div className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border bg-elev px-2 py-1 text-[11px] shadow-lg"
            style={{ left: Math.min(hover.x, Math.max(0, w - 150)), top: hover.y - 30 }}>
            <b>{hover.v}</b> {meta.curto} · {LINHAS[(dow(hover.dia) + 6) % 7]} {dmy(hover.dia)}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-7 items-end gap-1.5" style={{ height: 60 }}>
        {porDow.map((v, l) => (
          <div key={l} className="flex h-full flex-col items-center justify-end gap-1" title={`${LINHAS[l]}: média ${v.toFixed(1)} por dia`}>
            <span className="text-[9px] text-muted">{v.toFixed(1).replace('.', ',')}</span>
            <div key={`${m}-${l}`} className="dk-grow-y w-full rounded-t-md" style={{
              height: `${Math.max(4, (v / maxDow) * 70)}%`, background: meta.cor, opacity: l === melhor ? 1 : 0.45,
              ['--d' as string]: `${l * 60}ms`,
            }} />
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {LINHAS.map((d, l) => <span key={d} className={`text-center text-[10px] ${l === melhor ? 'font-bold text-fg' : 'text-muted'}`}>{d}</span>)}
      </div>
      <p className="mt-1 text-[11px] text-muted">Dia mais forte: <b className="text-fg2">{['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'][melhor]}</b> (média por dia da semana).</p>
    </section>
  )
}
