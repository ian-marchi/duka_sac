import Link from 'next/link'
import type { Pessoa } from '@/lib/analytics'
import { GRUPO_META, DIA_NOME, diffDays } from '@/lib/analytics'
import type { RelatoriosBase, AlunoDetalhe, Item } from '@/lib/alunosAnalise'
import { compactNumber, fullNumber } from '@/lib/format'
import { escolaCurta, type ResumoAlunos } from '@/lib/alunos'

/* ── peças ─────────────────────────────────────────────────────────────────── */

function Bar({ label, v, max, cor = 'rgb(var(--brand))' }: { label: string; v: number; max: number; cor?: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr_30px] items-center gap-2 text-[11px]">
      <span className="truncate text-fg2" title={label}>{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: cor }} /></div>
      <span className="text-right text-fg2">{v}</span>
    </div>
  )
}
function Bars({ itens, cor }: { itens: Item[]; cor?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.value))
  return <div className="space-y-1.5">{itens.map((i) => <Bar key={i.label} label={i.label} v={i.value} max={max} cor={cor} />)}</div>
}
function Card({ icon, title, tag, children, grow }: { icon: string; title: string; tag?: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={`card p-3.5 ${grow ? 'flex-1' : ''}`}>
      <h3 className="card-h flex items-center gap-2">
        <span>{icon}</span>{title}
        {tag && <span className="ml-auto rounded-full border border-brand bg-brandSoft px-2 text-[10px] font-bold text-brandText">{tag}</span>}
      </h3>
      {children}
    </div>
  )
}
function Avatar({ p, size = 28 }: { p: Pessoa; size?: number }) {
  return (
    <span className="relative flex shrink-0 items-center justify-center rounded-full bg-brand font-display font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {p.nome.trim().charAt(0).toUpperCase()}
      {p.premium && <span className="absolute rotate-[20deg]" style={{ top: -size * 0.3, right: -size * 0.22, fontSize: size * 0.4 }}>👑</span>}
    </span>
  )
}
const GrupoTag = ({ g }: { g: Pessoa['grupo'] }) => (
  <span className="rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold text-white" style={{ background: GRUPO_META[g].cor }}>{GRUPO_META[g].tag}</span>
)
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
const br1 = (n: number) => n.toFixed(1).replace('.', ',')

/* ── coluna 1: os três relatórios da base ──────────────────────────────────── */

export function RelatoriosColuna({ r, total, days, hoje, ws }: {
  r: RelatoriosBase; total: number; days: number; hoje: string; ws: ResumoAlunos
}) {
  const maxSem = Math.max(1, ...r.frequencia.semana.map((s) => s.v))
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto border-r bg-surface/40 px-3 py-3.5">
      <div className="flex items-center gap-2">
        <div className="font-display text-base font-extrabold">Alunos</div>
        <span className="text-xs text-fg2">{total} contas · {days} dias</span>
        <span className="ml-auto text-[11px] text-muted">até {hoje.split('-').reverse().join('/')}</span>
      </div>

      <Link href="/whatsapp" className="chip self-start" title="Quem chegou pelo WhatsApp, por escola — aba própria">
        💬 WhatsApp: {ws.total} abordados · {ws.comConta} já no app →
      </Link>

      <Card icon="📍" title="De onde vêm" tag="origem">
        <Bars itens={r.origem.escolas} />
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
          <div><div className="kicker">Tipo de escola</div>{r.origem.tipoEscola.map((i) => <span key={i.label} className="mr-2">{i.label} <b>{i.value}</b></span>)}</div>
          <div><div className="kicker">Como chegaram</div>{r.origem.canal.map((i) => <span key={i.label} className="mr-2">{i.label.replace(' (planilha)', '')} <b>{i.value}</b></span>)}</div>
        </div>
        {r.origem.exames.length > 0 && <div className="mt-2 text-[11px]"><span className="kicker">Vestibular: </span>{r.origem.exames.slice(0, 4).map((i) => `${i.label} ${i.value}`).join(' · ')}</div>}
        {r.origem.cursos.length > 0 && <div className="text-[11px]"><span className="kicker">Curso: </span>{r.origem.cursos.slice(0, 3).map((i) => `${i.label} ${i.value}`).join(' · ')}</div>}
      </Card>

      <Card icon="📅" title="Frequência" tag="hábito">
        <div className="mb-2 flex flex-wrap gap-1">
          {r.frequencia.grupos.map(({ g, n }) => <span key={g} className="rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold text-white" style={{ background: GRUPO_META[g].cor }}>{GRUPO_META[g].tag} {n}</span>)}
        </div>
        <div className="kicker mb-1">Aberturas por dia da semana</div>
        <div className="flex h-11 items-end gap-1">
          {r.frequencia.semana.map((s) => (
            <div key={s.d} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5" title={`${DIA_NOME[s.d]}: ${s.v}`}>
              <i className="w-full rounded-t" style={{ height: `${(s.v / maxSem) * 100}%`, background: s.v === maxSem ? 'rgb(var(--brand))' : 'rgb(var(--border))' }} />
              <span className="font-display text-[9px] font-bold text-muted">{s.d}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div><div className="font-display text-xl font-extrabold leading-none">{br1(r.frequencia.diasSemana)}</div><div className="kicker">dias/semana de quem abriu</div></div>
          <div><div className="font-display text-xl font-extrabold leading-none">{r.frequencia.rotina.esp ? Math.round((r.frequencia.rotina.cump / r.frequencia.rotina.esp) * 100) : 0}%</div><div className="kicker">do plano cumprido</div></div>
          <div><div className="font-display text-xl font-extrabold leading-none text-p0">{r.frequencia.sumiram}</div><div className="kicker">sumiram há 6+ dias</div></div>
        </div>
        <div className="mt-2"><Bars itens={r.frequencia.recencia} cor="rgb(var(--fg2))" /></div>
      </Card>

      <Card icon="⚡" title="Uso" tag="o que fazem" grow>
        {r.uso.recursos.length ? <Bars itens={r.uso.recursos} /> : <p className="text-xs text-muted">Nada usado no período.</p>}
        <div className="mt-2.5 text-[11px] text-fg2">
          Simulados: <b>{r.uso.simulados.n}</b>{r.uso.simulados.acerto !== null && <> · acerto médio <b>{pct(r.uso.simulados.acerto)}</b></>} · Redações: <b>{r.uso.redacoes}</b>
        </div>
        <div className="kicker mt-1">IA: {fullNumber(r.uso.ia.chamadas)} chamadas · {compactNumber(r.uso.ia.tokens)} tokens · US$ {r.uso.ia.custo.toFixed(2)} · {r.uso.ia.pessoas} pessoas · {r.uso.ia.erros} erros</div>
      </Card>
    </div>
  )
}

/* ── coluna 2: lista ───────────────────────────────────────────────────────── */

/** Chips fixos. Os das escolas vêm da planilha do WhatsApp (uma por escola que aparecer). */
export const FILTROS: { key: string; label: string }[] = [
  { key: 'todos', label: 'Todos' }, { key: 'sumiram', label: 'Sumiram' }, { key: 'habito', label: 'Hábito' },
  { key: 'nunca', label: 'Nunca abriram' },
]

export function AlunosLista({ pessoas, selected, f, q, hoje, escolaDe, escolas }: {
  pessoas: Pessoa[]; selected: string | null; f: string; q: string; hoje: string; escolaDe: (id: string) => string | null
  escolas: { slug: string; curto: string; escola: string; total: number }[]
}) {
  const href = (over: Partial<{ f: string; q: string; u: string }>) => {
    const p = new URLSearchParams()
    const ff = over.f ?? f, qq = over.q ?? q, uu = over.u ?? selected ?? ''
    if (ff && ff !== 'todos') p.set('f', ff)
    if (qq) p.set('q', qq)
    if (uu) p.set('u', uu)
    const s = p.toString()
    return `/alunos${s ? `?${s}` : ''}`
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b px-3 pb-2.5 pt-3">
        <form method="get" action="/alunos" className="flex gap-1.5">
          {f && f !== 'todos' && <input type="hidden" name="f" value={f} />}
          {selected && <input type="hidden" name="u" value={selected} />}
          <input name="q" defaultValue={q} placeholder="Nome, usuário, escola…" className="input" />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((x) => <Link key={x.key} href={href({ f: x.key })} className={`chip ${f === x.key ? 'chip-on' : ''}`}>{x.label}</Link>)}
          {escolas.map((e) => (
            <Link key={e.slug} href={href({ f: `escola:${e.slug}` })} title={`${e.escola} · ${e.total} no WhatsApp`}
              className={`chip ${f === `escola:${e.slug}` ? 'chip-on' : ''}`}>{e.curto}</Link>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {pessoas.length === 0 && <div className="p-10 text-center text-sm text-muted">Ninguém com esse filtro.</div>}
        {pessoas.map((p) => {
          const on = p.id === selected
          const esc = escolaDe(p.id)
          const dias = p.ultAb ? diffDays(p.ultAb, hoje) : null
          return (
            <Link key={p.id} href={href({ u: p.id })} scroll={false}
              className={`mb-1 flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 transition ${on ? 'border-brand border-b-[3px] bg-elev' : 'border-transparent hover:bg-surface'}`}>
              <Avatar p={p} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold">{p.user ? `@${p.user}` : p.nome}</span>
                <span className="block truncate text-[11px] text-muted">
                  {esc ? `${escolaCurta(esc)} · ` : ''}{p.diasAt} {p.diasAt === 1 ? 'dia' : 'dias'}{dias !== null ? ` · há ${dias}d` : ' · nunca abriu'}{p.ia ? ` · IA ${p.ia}` : ''}
                </span>
              </span>
              <GrupoTag g={p.grupo} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* ── coluna 3: uma pessoa ──────────────────────────────────────────────────── */

export function AlunoDetalheView({ d, hoje }: { d: AlunoDetalhe; hoje: string }) {
  const { p, ws } = d
  const maxCal = Math.max(1, ...d.calendario.map((c) => c.aberturas))
  const nivel = (n: number) => (n === 0 ? 'rgb(var(--border))' : n / maxCal < 0.34 ? '#4A2A6B' : n / maxCal < 0.67 ? '#7D2FA8' : 'rgb(var(--brand))')
  const esc = ws?.escola ?? (p.escola === 'publica' ? 'Escola pública' : p.escola === 'particular' ? 'Escola particular' : null)
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b px-5 py-3.5">
        <Avatar p={p} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-extrabold">{p.nome} {p.user && <span className="text-sm font-semibold text-fg2">@{p.user}</span>}</div>
          <div className="text-xs text-fg2">
            {p.premium ? '👑 Premium' : 'Free'} · {fullNumber(p.pontos)} pontos · conta desde {p.criado.split('-').reverse().join('/')}
            {p.ultAb ? ` · última abertura há ${diffDays(p.ultAb, hoje)} dias` : ' · nunca abriu o app'}
          </div>
        </div>
        <GrupoTag g={p.grupo} />
        {d.tickets.length > 0 && <Link href={`/tickets?t=${d.tickets[0].id}`} className="soft h-8 text-xs">Tickets · {d.tickets.length}</Link>}
      </div>

      <div className="grid gap-3 p-5 lg:grid-cols-2">
        <Card icon="📍" title="De onde veio">
          <dl className="grid grid-cols-[96px_1fr] gap-x-2.5 gap-y-1.5 text-xs">
            <dt className="text-muted">Escola</dt><dd>{esc ?? '—'}{ws?.ano && ws.ano !== 'Não informado' ? ` · ${ws.ano}` : ''}</dd>
            <dt className="text-muted">Chegou por</dt><dd>{ws ? `WhatsApp beta (${ws.status})` : 'Fora da planilha do WhatsApp'}</dd>
            <dt className="text-muted">Cadastro</dt><dd>{p.criado.split('-').reverse().join('/')} · onboarding {p.onboarding ? 'completo' : 'incompleto'}</dd>
            <dt className="text-muted">Objetivo</dt><dd>{[p.exame?.toUpperCase(), p.curso].filter(Boolean).join(' · ') || '—'}</dd>
            <dt className="text-muted">Idade</dt><dd>{p.idade ?? '—'}</dd>
            {ws?.obs && <><dt className="text-muted">Obs. WhatsApp</dt><dd className="text-fg2">{ws.obs}</dd></>}
          </dl>
        </Card>

        <Card icon="📅" title="Frequência">
          <div className="kicker mb-1">Últimos 14 dias · {p.diasAt} com o app aberto</div>
          <div className="grid grid-cols-14 gap-[3px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
            {d.calendario.map((c) => <i key={c.dia} title={`${c.dia.split('-').reverse().join('/')}: ${c.aberturas}`} className="block aspect-square rounded-[3px]" style={{ background: nivel(c.aberturas) }} />)}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <div><div className="font-display text-xl font-extrabold leading-none">{br1(d.diasSemana)}</div><div className="kicker">dias/semana</div></div>
            <div><div className="font-display text-xl font-extrabold leading-none">{p.ab}</div><div className="kicker">aberturas</div></div>
            <div><div className={`font-display text-xl font-extrabold leading-none ${p.esp && p.cump === p.esp ? 'text-ok' : ''}`}>{p.esp ? `${p.cump}/${p.esp}` : '—'}</div><div className="kicker">dias do plano cumpridos</div></div>
          </div>
          <div className="kicker mt-2">
            {p.planDias.length ? `Plano: ${p.planDias.map((x) => DIA_NOME[x]).join(', ')} · ${p.planHoras}h/semana` : 'Sem plano de estudos montado'}
            {p.extra ? ` · abriu ${p.extra} ${p.extra === 1 ? 'vez' : 'vezes'} fora do plano` : ''}
          </div>
        </Card>

        <Card icon="⚡" title="Uso">
          {d.recursos.length ? <Bars itens={d.recursos} /> : <p className="text-xs text-muted">Não usou nada no período.</p>}
          <div className="mt-2.5 text-[11px] text-fg2">
            Simulados: <b>{d.simulados.n}</b>{d.simulados.acerto !== null && <> · acerto <b>{pct(d.simulados.acerto)}</b></>} · Redações: <b>{d.redacoes}</b>
          </div>
          <div className="kicker mt-1">IA: {p.ia} chamadas · {compactNumber(p.tok)} tokens · US$ {p.custo.toFixed(2)}</div>
        </Card>

        <Card icon="🎫" title="Tickets dele">
          {d.tickets.length === 0 ? <p className="text-xs text-muted">Nenhum ticket aberto por esta pessoa.</p> : (
            <div className="space-y-1">
              {d.tickets.map((t) => (
                <Link key={t.id} href={`/tickets?t=${t.id}`} className="flex items-center gap-2 rounded-xl px-1 py-1 text-xs hover:bg-elev">
                  <span className={`rounded-md px-1.5 font-display text-[10px] font-extrabold ${t.priority === 'P0' ? 'bg-p0/20 text-p0' : t.priority === 'P1' ? 'bg-p1/20 text-p1' : 'bg-elev text-fg2'}`}>{t.priority}</span>
                  <span className="font-mono text-muted">{t.ref}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{t.title || '(sem título)'}</span>
                  <span className="text-muted">{t.status}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
