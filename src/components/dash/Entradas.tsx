'use client'

import { useMemo, useState } from 'react'
import { addDays } from '@/lib/analytics'
import {
  type Bruto, type Metrica, type Indice, METRICA_META, indexar, resumo, baldes, anterior, variacao,
  inicioBalde, granPadrao, dm,
} from '@/lib/serieTempo'
import { CountUp, Delta, Spark, Seg } from './base'

type Janela = { chave: string; titulo: string; sub: string; de: string; ate: string; ant: { de: string; ate: string }; vs: string; spark: number[] }

function mesAnterior(hoje: string) {
  const [y, m, d] = hoje.split('-').map(Number)
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1
  const ini = `${py}-${String(pm).padStart(2, '0')}-01`
  const fimMes = addDays(`${y}-${String(m).padStart(2, '0')}-01`, -1)
  const mesmoDia = `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { de: ini, ate: mesmoDia > fimMes ? fimMes : mesmoDia }
}

function janelas(ix: Indice, hoje: string, de: string, ate: string, m: Metrica): Janela[] {
  const semIni = inicioBalde(hoje, 'semana')
  const mesIni = inicioBalde(hoje, 'mes')
  const serie = (a: string, z: string, g: 'dia' | 'semana' | 'mes') => baldes(ix, a, z, g).map((b) => b[m])
  return [
    { chave: 'hoje', titulo: 'Hoje', sub: dm(hoje), de: hoje, ate: hoje,
      ant: { de: addDays(hoje, -1), ate: addDays(hoje, -1) }, vs: 'vs ontem',
      spark: serie(addDays(hoje, -13), hoje, 'dia') },
    { chave: 'semana', titulo: 'Esta semana', sub: `desde seg ${dm(semIni)}`, de: semIni, ate: hoje,
      ant: { de: addDays(semIni, -7), ate: addDays(hoje, -7) }, vs: 'vs semana passada',
      spark: serie(addDays(semIni, -49), hoje, 'semana') },
    { chave: 'mes', titulo: 'Este mês', sub: `desde ${dm(mesIni)}`, de: mesIni, ate: hoje,
      ant: mesAnterior(hoje), vs: 'vs mês passado',
      spark: serie(inicioBalde(addDays(mesIni, -150), 'mes'), hoje, 'mes') },
    { chave: 'intervalo', titulo: 'Intervalo', sub: `${dm(de)} a ${dm(ate)}`, de, ate,
      ant: anterior(de, ate), vs: 'vs período anterior',
      spark: serie(de, ate, granPadrao(de, ate)) },
  ]
}

/**
 * "Quando os usuários entram": hoje, semana, mês e o intervalo escolhido no
 * filtro, cada um com a variação contra a janela anterior equivalente e um
 * minigráfico da tendência. A métrica troca aqui mesmo, sem recarregar.
 */
export function Entradas({ bruto, hoje, de, ate }: { bruto: Bruto; hoje: string; de: string; ate: string }) {
  const [m, setM] = useState<Metrica>('ativos')
  const ix = useMemo(() => indexar(bruto), [bruto])
  const js = useMemo(() => janelas(ix, hoje, de, ate, m), [ix, hoje, de, ate, m])
  const meta = METRICA_META[m]

  return (
    <section className="dk-tile">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="dk-h">Quando os usuários entram</h2>
          <p className="kicker">{meta.desc} · pessoas contadas uma vez por janela</p>
        </div>
        <Seg value={m} onChange={setM} opcoes={[
          { v: 'ativos', l: 'Entraram' }, { v: 'aberturas', l: 'Aberturas' }, { v: 'novos', l: 'Cadastros' },
        ]} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {js.map((j, i) => {
          const atual = resumo(ix, j.de, j.ate)
          const antes = resumo(ix, j.ant.de, j.ant.ate)
          const outras = (['ativos', 'aberturas', 'novos'] as Metrica[]).filter((x) => x !== m)
          return (
            <div key={j.chave} className="dk-fade-up rounded-xl border bg-bg/60 p-3" style={{ ['--d' as string]: `${i * 80}ms` }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-xs font-bold text-fg2">{j.titulo}</span>
                <span className="text-[10px] text-muted">{j.sub}</span>
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="font-display text-3xl font-extrabold leading-none" style={{ color: meta.cor }}>
                  <CountUp value={atual[m]} />
                </div>
                <Delta pct={variacao(atual[m], antes[m])} />
              </div>
              <div className="mt-0.5 text-[10px] text-muted">{meta.curto} · {j.vs}: {antes[m].toLocaleString('pt-BR')}</div>
              <div className="mt-2"><Spark key={`${m}-${j.chave}`} data={j.spark} cor={meta.cor} /></div>
              <div className="mt-1.5 flex gap-3 text-[11px] text-fg2">
                {outras.map((o) => (
                  <span key={o}><b className="text-fg">{atual[o].toLocaleString('pt-BR')}</b> {METRICA_META[o].curto}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
