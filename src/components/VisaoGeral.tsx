import type { Analise, Grupo } from '@/lib/analytics'
import { DIAS, DIA_NOME, GRUPO_META } from '@/lib/analytics'
import type { Bruto } from '@/lib/serieTempo'
import { PeopleTable } from './PeopleTable'
import { CountUp, type Fmt } from './dash/base'
import { FiltroPeriodo } from './dash/FiltroPeriodo'
import { Entradas } from './dash/Entradas'
import { LinhaDoTempo } from './dash/LinhaDoTempo'
import { Calendario } from './dash/Calendario'
import { GruposDonut } from './dash/GruposDonut'
import { UltimosTickets, Top5, type TicketCurto, type FilaResumo, type Lider } from './dash/Blocos'

const pctN = (a: number, b: number) => (b ? (a / b) * 100 : 0)
const pct = (a: number, b: number) => (b ? `${(a / b * 100).toFixed(a / b * 100 >= 10 ? 0 : 1).replace('.', ',')}%` : '0%')
const br1 = (n: number) => n.toFixed(1).replace('.', ',')

/**
 * Visão geral (home) em formato de dashboard: filtro de período fixo no topo,
 * "quando os usuários entram" (hoje/semana/mês/intervalo), linha do tempo
 * interativa, top 5 do ranking, mapa de calor por dia da semana, últimos
 * tickets e, embaixo, a análise de sempre (KPIs, funil, grupos, rotina,
 * tabela, perfil, achados) com gráficos animados.
 */
export function VisaoGeral({ a, bruto, de, ate, periodo, showAll, hidden, tickets, fila, lideres }: {
  a: Analise
  bruto: Bruto
  de: string
  ate: string
  periodo: string | null
  showAll: boolean
  hidden: number
  tickets: TicketCurto[]
  fila: FilaResumo
  lideres: Lider[]
}) {
  const { kpis: k, total } = a
  const fatias = (Object.keys(GRUPO_META) as Grupo[]).map((g) => ({
    chave: g, titulo: GRUPO_META[g].titulo, sub: GRUPO_META[g].sub, cor: GRUPO_META[g].cor, n: a.grupos[g].length,
    nomes: a.grupos[g].map((p) => `${p.nome}${p.ab ? ` · ${p.ab}` : ''}`),
  }))

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-6 md:px-6">
      <FiltroPeriodo periodo={periodo} de={de} ate={ate} hoje={a.hoje} showAll={showAll} hidden={hidden} />

      <header className="dk-fade-up mb-4">
        <h1 className="font-display text-2xl font-extrabold">Visão geral</h1>
        <p className="mt-0.5 text-xs text-muted">
          users × app_opens × ai_usage · {total} contas{hidden && !showAll ? ` (sem ${hidden} de teste)` : ''} · período {de.split('-').reverse().join('/')} a {ate.split('-').reverse().join('/')} ({a.days} dias)
        </p>
      </header>

      <Entradas bruto={bruto} hoje={a.hoje} de={de} ate={ate} />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8"><LinhaDoTempo bruto={bruto} de={de} ate={ate} /></div>
        <div className="lg:col-span-4"><Top5 lideres={lideres} /></div>
        <div className="lg:col-span-5"><Calendario bruto={bruto} hoje={a.hoje} /></div>
        <div className="lg:col-span-7"><UltimosTickets tickets={tickets} fila={fila} /></div>
      </div>

      {/* KPIs */}
      <Section title="Números do período" note="mesmas definições do JARVIS (migration 081)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi i={0} label="Contas criadas" v={total} foot="toda a base" cor="rgb(var(--muted))" />
          <Kpi i={1} label="Chegaram a abrir o app" v={k.abriram} s={pct(k.abriram, total)} barra={pctN(k.abriram, total)} foot={`${total - k.abriram} nunca abriram uma vez sequer`} cor="rgb(29 111 196)" />
          <Kpi i={2} label="Abriram nos últimos 7 dias" v={k.at7} s={pct(k.at7, total)} barra={pctN(k.at7, total)} foot={`${k.at2} abriram nas últimas 48 horas`} cor="rgb(14 148 105)" />
          <Kpi i={3} label="Voltaram em 5 dias ou mais" v={k.habito} s={pct(k.habito, total)} barra={pctN(k.habito, total)} foot="o núcleo que criou hábito" cor="rgb(91 52 199)" />
          <Kpi i={4} mini label="Aberturas no período" v={k.somaAb} foot={`média de ${br1(k.somaAb / Math.max(k.abriram, 1))} por pessoa que abriu`} />
          <Kpi i={5} mini label="Chamadas de IA" v={k.somaIA} foot={`${k.usouIA} pessoas usaram algum recurso de IA`} />
          <Kpi i={6} mini label="Tokens consumidos" v={k.somaTok} fmt="compact" foot={`US$ ${k.somaCusto.toFixed(2)} · ${Math.round(k.somaTok / Math.max(k.somaIA, 1)).toLocaleString('pt-BR')} tokens por chamada`} />
          <Kpi i={7} mini label="Chamadas com erro" v={k.falhasIA} foot={k.falhasIA ? 'ver Relatório de erros' : 'nenhuma no período'} cor={k.falhasIA ? 'rgb(var(--p0))' : undefined} />
        </div>
      </Section>

      {/* Funil + grupos */}
      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        <div className="dk-tile lg:col-span-7">
          <h2 className="dk-h">Do cadastro ao hábito</h2>
          <p className="kicker mb-3">funil medido por abertura real do app, não por pontos</p>
          <div className="space-y-2.5">
            {a.funil.map((f, i) => {
              const perdeu = i > 0 ? a.funil[i - 1].v - f.v : 0
              return (
                <div key={f.n}>
                  <div className="grid grid-cols-[130px_1fr_52px] items-center gap-3 md:grid-cols-[200px_1fr_64px]">
                    <div className="text-sm text-fg/80">{f.n}<em className="block text-xs not-italic text-muted">{f.e}</em></div>
                    <div className="h-8 overflow-hidden rounded-lg bg-bg">
                      <div className="dk-grow-x flex h-full items-center rounded-lg pl-3 text-sm font-bold text-white"
                        style={{ width: `${pctN(f.v, total)}%`, background: `linear-gradient(90deg, ${f.cor}, ${f.cor.replace(')', ' / .65)')})`, minWidth: f.v ? 30 : 0, ['--d' as string]: `${i * 140}ms` }}>
                        <CountUp value={f.v} />
                      </div>
                    </div>
                    <div className="text-right text-sm font-bold text-fg2">{pct(f.v, total)}</div>
                  </div>
                  {perdeu > 0 && <div className="grid grid-cols-[130px_1fr] gap-3 text-[11px] text-p0 md:grid-cols-[200px_1fr]"><span /><span>▼ {perdeu} {perdeu === 1 ? 'pessoa' : 'pessoas'} ({pct(perdeu, a.funil[i - 1].v)} da etapa anterior)</span></div>}
                </div>
              )
            })}
          </div>
        </div>
        <div className="dk-tile lg:col-span-5">
          <h2 className="dk-h">Quatro grupos de comportamento</h2>
          <p className="kicker mb-3">por quantos dias distintos abriram o app no período</p>
          <GruposDonut fatias={fatias} total={total} />
        </div>
      </div>

      {/* Recência + aderência semanal */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="dk-tile lg:col-span-6">
          <h2 className="dk-h">Última vez que cada pessoa abriu o app</h2>
          <p className="kicker mb-3">contado a partir de hoje</p>
          <div className="space-y-2">
            {a.recencia.map((r, i) => <Bar key={r.label} i={i} label={r.label} v={r.value} max={total} cor={r.cor} />)}
          </div>
        </div>
        <div className="dk-tile lg:col-span-6">
          <h2 className="dk-h">Aderência à rotina por dia da semana</h2>
          <p className="kicker mb-3">dias planejados (cinza) que viraram uso (verde), somando todo mundo</p>
          <div className="space-y-2">
            {a.rotina.semana.map((s, i) => {
              const mx = Math.max(1, ...a.rotina.semana.map((x) => x.esp))
              return (
                <div key={s.d} className="grid grid-cols-[80px_1fr_40px] items-center gap-2 text-xs">
                  <span className="text-fg/80">{DIA_NOME[s.d]}</span>
                  <div className="relative h-4 overflow-hidden rounded bg-bg">
                    <div className="dk-grow-x absolute inset-y-0 left-0 rounded bg-border" style={{ width: `${(s.esp / mx) * 100}%`, ['--d' as string]: `${i * 70}ms` }} />
                    <div className="dk-grow-x absolute inset-y-0 left-0 rounded bg-emerald-600" style={{ width: `${(s.cump / mx) * 100}%`, ['--d' as string]: `${300 + i * 70}ms` }} />
                  </div>
                  <span className="text-right font-bold text-fg2">{s.esp ? `${Math.round((s.cump / s.esp) * 100)}%` : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Rotina */}
      <Section title="A rotina que planejaram e a que cumpriram" note={`${a.rotina.com} de ${total} pessoas montaram uma rotina no onboarding`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi i={0} mini label="Rotina média planejada" v={a.rotina.medDias} fmt="dec1" s="dias por semana" foot={`${a.rotina.medHoras.toFixed(0)} h semanais em média${a.rotina.medDias ? `, ou ${br1(a.rotina.medHoras / a.rotina.medDias)} h por dia de estudo` : ''}`} />
          <Kpi i={1} mini label="Dias planejados cumpridos" v={pctN(a.rotina.cump, a.rotina.esp)} fmt="pct" barra={pctN(a.rotina.cump, a.rotina.esp)} foot={`${a.rotina.cump} de ${a.rotina.esp} dias planejados no período tiveram o app aberto`} cor="rgb(14 148 105)" />
          <Kpi i={2} mini label="Não cumpriram nenhum dia" v={a.rotina.zero.length} foot={a.rotina.zero.length ? a.rotina.zero.map((p) => p.nome.split(' ')[0]).join(', ') : '—'} />
          <Kpi i={3} mini label="Usaram fora do planejado" v={a.rotina.extra} s="dias" foot="aberturas em dias que a pessoa não tinha reservado" />
        </div>
        <div className="dk-tile mt-4">
          <h3 className="dk-h">Dia a dia de cada pessoa</h3>
          <p className="kicker">Cinza é dia planejado no onboarding. Verde é dia planejado em que a pessoa abriu o app, dentro do período.</p>
          <div className="mt-3">
            <div className="grid grid-cols-[120px_1fr_100px] gap-3 border-b pb-1.5 text-xs text-muted md:grid-cols-[170px_1fr_150px]">
              <span>Pessoa</span>
              <div className="grid grid-cols-7 gap-1 text-center">{DIAS.map((d) => <span key={d}>{d}</span>)}</div>
              <span className="text-right">Dias cumpridos</span>
            </div>
            {[...a.pessoas].filter((p) => p.planDias.length).sort((x, y) => ((y.esp ? y.cump / y.esp : 0) - (x.esp ? x.cump / x.esp : 0)) || y.cump - x.cump).map((p, r) => (
              <div key={p.id} className="grid grid-cols-[120px_1fr_100px] items-center gap-3 border-b py-1.5 text-sm last:border-b-0 md:grid-cols-[170px_1fr_150px]">
                <div className="truncate text-fg/80"><b className="font-semibold text-fg">{p.nome.split(' ')[0]}</b> <span className="text-xs text-muted">{p.planDias.length}d · {p.planHoras}h/sem</span></div>
                <div className="grid grid-cols-7 gap-1">
                  {DIAS.map((d, c) => {
                    const plan = p.planDias.includes(d); const ok = plan && p.diasCump.includes(d)
                    return <div key={d} className={`flex h-7 items-center justify-center rounded text-[11px] font-semibold ${ok ? 'dk-pop bg-emerald-600 text-white' : plan ? 'bg-bg text-muted' : ''}`} style={ok ? { ['--d' as string]: `${Math.min(r, 12) * 40 + c * 30}ms` } : undefined}>{plan ? (ok ? '✓' : '·') : ''}</div>
                  })}
                </div>
                <div className="whitespace-nowrap text-right text-fg/80"><b className="font-semibold">{p.cump}</b> de {p.esp} <span className="text-xs text-muted">({p.esp ? pct(p.cump, p.esp) : '—'})</span></div>
              </div>
            ))}
            {a.rotina.sem.length > 0 && <p className="mt-3 text-xs text-muted">{a.rotina.sem.length} pessoas não chegaram a montar rotina: {a.rotina.sem.map((p) => p.nome).join(', ')}.</p>}
          </div>
        </div>
      </Section>

      {/* Tabela */}
      <Section title="Cada pessoa em uma linha" note="clique nas colunas para reordenar">
        <div className="dk-tile">
          <PeopleTable pessoas={a.pessoas} hoje={a.hoje} />
        </div>
      </Section>

      {/* Perfil */}
      <Section title="Perfil de quem se cadastrou">
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Prova alvo">{a.perfil.exames.map((x, i) => <Bar key={x.label} i={i} label={x.label} v={x.value} max={total} cor="rgb(var(--brand))" />)}</Card>
          <Card title="Curso pretendido">{a.perfil.cursos.map((x, i) => <Bar key={x.label} i={i} label={x.label} v={x.value} max={total} cor="rgb(56 152 236)" />)}</Card>
          <Card title="Idade">
            {a.perfil.idades.map((x, i) => <Bar key={x.label} i={i} label={x.label} v={x.value} max={total} cor="rgb(14 148 105)" />)}
            <p className="mt-3 text-xs text-muted">{a.perfil.particular} vêm de escola particular e {a.perfil.publica} de escola pública.{a.perfil.medianaIdade ? ` Mediana de idade: ${a.perfil.medianaIdade} anos.` : ''}</p>
          </Card>
        </div>
      </Section>

      {/* Achados */}
      <Section title="O que os três arquivos juntos revelam">
        <div className="grid gap-4 md:grid-cols-3">
          {a.achados.map((x, i) => (
            <div key={x.titulo} className="dk-tile dk-fade-up border-l-4" style={{ borderLeftColor: x.cor, ['--d' as string]: `${i * 100}ms` }}>
              <p className="mb-1.5 text-xs font-bold" style={{ color: x.cor }}>{x.flag}</p>
              <h3 className="mb-1.5 text-sm font-semibold">{x.titulo}</h3>
              <p className="text-xs text-fg/80">{x.texto}</p>
            </div>
          ))}
        </div>
      </Section>

      <footer className="mt-8 border-t pt-4 text-xs text-muted">
        Fontes: <code>users</code> ({total} contas), <code>app_opens</code>, <code>ai_usage</code> e <code>support.tickets</code>. Definições iguais às do JARVIS (migration 081).
      </footer>
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline gap-3"><h2 className="font-display text-base font-bold">{title}</h2>{note && <span className="text-xs text-muted">{note}</span>}</div>
      {children}
    </section>
  )
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="dk-tile"><h3 className="dk-h mb-3">{title}</h3><div className="space-y-2">{children}</div></div>
}
function Kpi({ label, v, s, foot, cor, mini, fmt, barra, i = 0 }: {
  label: string; v: number; s?: string; foot?: string; cor?: string; mini?: boolean; fmt?: Fmt; barra?: number; i?: number
}) {
  return (
    <div className="dk-tile dk-fade-up" style={{ ['--d' as string]: `${i * 60}ms` }}>
      <div className="text-xs text-muted">{cor && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: cor }} />}{label}</div>
      <div className={`${mini ? 'text-2xl' : 'text-3xl'} font-display font-extrabold leading-tight tracking-tight`}>
        <CountUp value={v} fmt={fmt} />{s && <small className="ml-1 text-sm font-medium text-muted">{s}</small>}
      </div>
      {barra !== undefined && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg">
          <div className="dk-grow-x h-full rounded-full" style={{ width: `${Math.min(100, barra)}%`, background: cor ?? 'rgb(var(--brand))', ['--d' as string]: `${200 + i * 60}ms` }} />
        </div>
      )}
      {foot && <div className="mt-1 text-xs text-fg/70">{foot}</div>}
    </div>
  )
}
function Bar({ label, v, max, cor, i = 0 }: { label: string; v: number; max: number; cor: string; i?: number }) {
  return (
    <div className="grid grid-cols-[120px_1fr_36px] items-center gap-2 text-xs">
      <span className="truncate text-fg/80">{label}</span>
      <div className="h-4 overflow-hidden rounded bg-bg">
        <div className="dk-grow-x h-full rounded" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: cor, ['--d' as string]: `${i * 90}ms` }} />
      </div>
      <span className="text-right font-bold text-fg2">{v}</span>
    </div>
  )
}
