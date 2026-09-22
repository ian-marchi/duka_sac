import Link from 'next/link'
import type { Analise, Grupo } from '@/lib/analytics'
import { DIAS, DIA_NOME, GRUPO_META } from '@/lib/analytics'
import { compactNumber, fullNumber } from '@/lib/format'
import { PeopleTable } from './PeopleTable'

const pct = (a: number, b: number) => (b ? `${(a / b * 100).toFixed(a / b * 100 >= 10 ? 0 : 1).replace('.', ',')}%` : '0%')
const br1 = (n: number) => n.toFixed(1).replace('.', ',')

export function VisaoGeral({ a, periodos, periodo, showAll, hidden }: {
  a: Analise
  periodos: string[]
  periodo: string
  showAll: boolean
  hidden: number
}) {
  const { kpis: k, total } = a
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Quem abre o app, quem usa a IA, quem sumiu</h1>
          <p className="mt-1 max-w-[60ch] text-xs text-muted">
            Cruzamento de users × app_opens × ai_usage. Janela: últimos {a.days} dias (até {a.hoje.split('-').reverse().join('/')}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex gap-1">
            {periodos.map((p) => (
              <Link key={p} href={`/?p=${p}${showAll ? '&todos=1' : ''}`}
                className={`rounded-lg px-3 py-1 ${periodo === p ? 'bg-brand text-white' : 'text-muted hover:bg-bg'}`}>{p}</Link>
            ))}
          </span>
          {hidden > 0 || showAll ? (
            <Link href={`/?p=${periodo}${showAll ? '' : '&todos=1'}`} className="rounded-full border bg-surface px-3 py-1 text-muted hover:text-fg">
              {showAll ? 'Ocultar contas de teste' : `Mostrar ${hidden} conta(s) de teste`}
            </Link>
          ) : null}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Contas criadas" v={total} foot="toda a base" cor="rgb(var(--muted))" />
        <Kpi label="Chegaram a abrir o app" v={k.abriram} s={pct(k.abriram, total)} foot={`${total - k.abriram} nunca abriram uma vez sequer`} cor="rgb(29 111 196)" />
        <Kpi label="Abriram nos últimos 7 dias" v={k.at7} s={pct(k.at7, total)} foot={`${k.at2} abriram nas últimas 48 horas`} cor="rgb(14 148 105)" />
        <Kpi label="Voltaram em 5 dias ou mais" v={k.habito} s={pct(k.habito, total)} foot="o núcleo que criou hábito" cor="rgb(91 52 199)" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi mini label="Aberturas no período" v={fullNumber(k.somaAb)} foot={`média de ${br1(k.somaAb / Math.max(k.abriram, 1))} por pessoa que abriu`} />
        <Kpi mini label="Chamadas de IA" v={fullNumber(k.somaIA)} foot={`${k.usouIA} pessoas usaram algum recurso de IA`} />
        <Kpi mini label="Tokens consumidos" v={compactNumber(k.somaTok)} foot={`US$ ${k.somaCusto.toFixed(2)} · ${fullNumber(Math.round(k.somaTok / Math.max(k.somaIA, 1)))} tokens por chamada`} />
        <Kpi mini label="Chamadas com erro" v={k.falhasIA} foot={k.falhasIA ? 'ver Relatório de erros' : 'nenhuma no período'} />
      </div>

      {/* Funil */}
      <Section title="Do cadastro ao hábito" note="funil medido por abertura real do app, não por pontos">
        <div className="rounded-2xl border bg-surface p-4">
          <div className="space-y-2.5">
            {a.funil.map((f, i) => {
              const perdeu = i > 0 ? a.funil[i - 1].v - f.v : 0
              return (
                <div key={f.n}>
                  <div className="grid grid-cols-[150px_1fr_60px] items-center gap-3 md:grid-cols-[230px_1fr_80px]">
                    <div className="text-sm text-fg/80">{f.n}<em className="block text-xs not-italic text-muted">{f.e}</em></div>
                    <div className="h-8 overflow-hidden rounded-md bg-bg">
                      <div className="flex h-full items-center rounded-md pl-3 text-sm font-semibold text-white" style={{ width: `${total ? (f.v / total) * 100 : 0}%`, background: f.cor, minWidth: f.v ? 28 : 0 }}>{f.v}</div>
                    </div>
                    <div className="text-right text-sm text-muted">{pct(f.v, total)}</div>
                  </div>
                  {perdeu > 0 && <div className="grid grid-cols-[150px_1fr] gap-3 text-xs text-p0 md:grid-cols-[230px_1fr]"><span /><span>−{perdeu} {perdeu === 1 ? 'pessoa' : 'pessoas'}</span></div>}
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* Grupos + recência */}
      <Section title="Quatro grupos de comportamento" note="classificados por quantos dias distintos abriram o app">
        <div className="grid gap-4 md:grid-cols-[7fr_5fr]">
          <div className="rounded-2xl border bg-surface p-4">
            {(Object.keys(GRUPO_META) as Grupo[]).map((g) => {
              const m = GRUPO_META[g]; const l = a.grupos[g]
              return (
                <div key={g} className="mb-4 border-l-[3px] pl-3 last:mb-0" style={{ borderColor: m.cor }}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-bold" style={{ color: m.cor }}>{l.length}</span>
                    <h3 className="text-sm font-semibold">{m.titulo}</h3>
                    <span className="text-xs text-muted">{pct(l.length, total)} da base</span>
                  </div>
                  <p className="my-1.5 max-w-[62ch] text-xs text-fg/80">{m.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {l.map((p) => <span key={p.id} className="rounded-full bg-bg px-2 py-0.5 text-xs text-fg/80">{p.nome}{p.ab ? ` · ${p.ab} ${p.ab === 1 ? 'abertura' : 'aberturas'}` : ''}</span>)}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="rounded-2xl border bg-surface p-4">
            <h3 className="text-sm font-semibold">Quando cada pessoa abriu o app pela última vez</h3>
            <p className="mt-1 text-xs text-muted">Contado a partir de hoje.</p>
            <div className="mt-3 space-y-2">
              {a.recencia.map((r) => <Bar key={r.label} label={r.label} v={r.value} max={total} cor={r.cor} />)}
            </div>
          </div>
        </div>
      </Section>

      {/* Rotina */}
      <Section title="A rotina que planejaram e a que cumpriram" note={`${a.rotina.com} de ${total} pessoas montaram uma rotina no onboarding`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi mini label="Rotina média planejada" v={br1(a.rotina.medDias)} s="dias por semana" foot={`${a.rotina.medHoras.toFixed(0)} h semanais em média${a.rotina.medDias ? `, ou ${br1(a.rotina.medHoras / a.rotina.medDias)} h por dia de estudo` : ''}`} />
          <Kpi mini label="Dias planejados cumpridos" v={pct(a.rotina.cump, a.rotina.esp)} foot={`${a.rotina.cump} de ${a.rotina.esp} dias planejados no período tiveram o app aberto`} />
          <Kpi mini label="Não cumpriram nenhum dia" v={a.rotina.zero.length} foot={a.rotina.zero.length ? a.rotina.zero.map((p) => p.nome.split(' ')[0]).join(', ') : '—'} />
          <Kpi mini label="Usaram fora do planejado" v={a.rotina.extra} s="dias" foot="aberturas em dias que a pessoa não tinha reservado" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[8fr_4fr]">
          <div className="rounded-2xl border bg-surface p-4">
            <h3 className="text-sm font-semibold">Dia a dia de cada pessoa</h3>
            <p className="mt-1 text-xs text-muted">Cinza é dia planejado no onboarding. Verde é dia planejado em que a pessoa abriu o app, dentro da janela.</p>
            <div className="mt-3">
              <div className="grid grid-cols-[120px_1fr_100px] gap-3 border-b pb-1.5 text-xs text-muted md:grid-cols-[170px_1fr_150px]">
                <span>Pessoa</span>
                <div className="grid grid-cols-7 gap-1 text-center">{DIAS.map((d) => <span key={d}>{d}</span>)}</div>
                <span className="text-right">Dias cumpridos</span>
              </div>
              {[...a.pessoas].filter((p) => p.planDias.length).sort((x, y) => ((y.esp ? y.cump / y.esp : 0) - (x.esp ? x.cump / x.esp : 0)) || y.cump - x.cump).map((p) => (
                <div key={p.id} className="grid grid-cols-[120px_1fr_100px] items-center gap-3 border-b py-1.5 text-sm last:border-b-0 md:grid-cols-[170px_1fr_150px]">
                  <div className="truncate text-fg/80"><b className="font-semibold text-fg">{p.nome.split(' ')[0]}</b> <span className="text-xs text-muted">{p.planDias.length}d · {p.planHoras}h/sem</span></div>
                  <div className="grid grid-cols-7 gap-1">
                    {DIAS.map((d) => {
                      const plan = p.planDias.includes(d); const ok = plan && p.diasCump.includes(d)
                      return <div key={d} className={`flex h-7 items-center justify-center rounded text-[11px] font-semibold ${ok ? 'bg-emerald-600 text-white' : plan ? 'bg-bg text-muted' : ''}`}>{plan ? (ok ? '✓' : '·') : ''}</div>
                    })}
                  </div>
                  <div className="whitespace-nowrap text-right text-fg/80"><b className="font-semibold">{p.cump}</b> de {p.esp} <span className="text-xs text-muted">({p.esp ? pct(p.cump, p.esp) : '—'})</span></div>
                </div>
              ))}
              {a.rotina.sem.length > 0 && <p className="mt-3 text-xs text-muted">{a.rotina.sem.length} pessoas não chegaram a montar rotina: {a.rotina.sem.map((p) => p.nome).join(', ')}.</p>}
            </div>
          </div>
          <div className="rounded-2xl border bg-surface p-4">
            <h3 className="text-sm font-semibold">Aderência por dia da semana</h3>
            <p className="mt-1 text-xs text-muted">Dias planejados que viraram uso, somando todo mundo.</p>
            <div className="mt-3 space-y-2">
              {a.rotina.semana.map((s) => {
                const mx = Math.max(1, ...a.rotina.semana.map((x) => x.esp))
                return (
                  <div key={s.d} className="grid grid-cols-[80px_1fr_40px] items-center gap-2 text-xs">
                    <span className="text-fg/80">{DIA_NOME[s.d]}</span>
                    <div className="relative h-4 overflow-hidden rounded bg-bg">
                      <div className="absolute inset-y-0 left-0 rounded bg-border" style={{ width: `${(s.esp / mx) * 100}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded bg-emerald-600" style={{ width: `${(s.cump / mx) * 100}%` }} />
                    </div>
                    <span className="text-right text-muted">{s.esp ? `${Math.round((s.cump / s.esp) * 100)}%` : '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Tabela */}
      <Section title="Cada pessoa em uma linha" note="clique nas colunas para reordenar">
        <div className="rounded-2xl border bg-surface p-4">
          <PeopleTable pessoas={a.pessoas} hoje={a.hoje} />
        </div>
      </Section>

      {/* Perfil */}
      <Section title="Perfil de quem se cadastrou">
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Prova alvo">{a.perfil.exames.map((x) => <Bar key={x.label} label={x.label} v={x.value} max={total} cor="rgb(91 52 199)" />)}</Card>
          <Card title="Curso pretendido">{a.perfil.cursos.map((x) => <Bar key={x.label} label={x.label} v={x.value} max={total} cor="rgb(91 52 199)" />)}</Card>
          <Card title="Idade">
            {a.perfil.idades.map((x) => <Bar key={x.label} label={x.label} v={x.value} max={total} cor="rgb(91 52 199)" />)}
            <p className="mt-3 text-xs text-muted">{a.perfil.particular} vêm de escola particular e {a.perfil.publica} de escola pública.{a.perfil.medianaIdade ? ` Mediana de idade: ${a.perfil.medianaIdade} anos.` : ''}</p>
          </Card>
        </div>
      </Section>

      {/* Achados */}
      <Section title="O que os três arquivos juntos revelam">
        <div className="grid gap-4 md:grid-cols-3">
          {a.achados.map((x) => (
            <div key={x.titulo} className="rounded-2xl border bg-surface p-4">
              <p className="mb-1.5 text-xs font-semibold" style={{ color: x.cor }}>{x.flag}</p>
              <h3 className="mb-1.5 text-sm font-semibold">{x.titulo}</h3>
              <p className="text-xs text-fg/80">{x.texto}</p>
            </div>
          ))}
        </div>
      </Section>

      <footer className="mt-8 border-t pt-4 text-xs text-muted">
        Fontes: <code>users</code> ({total} contas), <code>app_opens</code> e <code>ai_usage</code>. Definições iguais às do JARVIS (migration 081).
      </footer>
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline gap-3"><h2 className="text-base font-bold">{title}</h2>{note && <span className="text-xs text-muted">{note}</span>}</div>
      {children}
    </section>
  )
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-surface p-4"><h3 className="mb-3 text-sm font-semibold">{title}</h3><div className="space-y-2">{children}</div></div>
}
function Kpi({ label, v, s, foot, cor, mini }: { label: string; v: string | number; s?: string; foot?: string; cor?: string; mini?: boolean }) {
  return (
    <div className="rounded-2xl border bg-surface p-4">
      <div className="text-xs text-muted">{cor && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: cor }} />}{label}</div>
      <div className={`${mini ? 'text-2xl' : 'text-3xl'} font-bold leading-tight tracking-tight`}>{v}{s && <small className="ml-1 text-sm font-medium text-muted">{s}</small>}</div>
      {foot && <div className="mt-1 text-xs text-fg/70">{foot}</div>}
    </div>
  )
}
function Bar({ label, v, max, cor }: { label: string; v: number; max: number; cor: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr_36px] items-center gap-2 text-xs">
      <span className="truncate text-fg/80">{label}</span>
      <div className="h-4 overflow-hidden rounded bg-bg"><div className="h-full rounded" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: cor }} /></div>
      <span className="text-right text-muted">{v}</span>
    </div>
  )
}
