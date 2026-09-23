import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import type { AppUser, AppOpen, AiUsageRow, Report } from '@/lib/types'
import { analisar, addDays, hojeSP, diffDays, GRUPO_META } from '@/lib/analytics'
import { carregarAlunos, resumirAlunos } from '@/lib/alunos'
import { FilaLista } from '@/components/FilaLista'
import { TicketDetalhe } from '@/components/TicketDetalhe'

export const dynamic = 'force-dynamic'

/**
 * Mesa de tickets (desenho F): três colunas fixas.
 *   1. Hoje — resumo da manhã, quatro números, quem sumiu
 *   2. lista de tickets (busca + chips)            → FilaLista (cliente)
 *   3. o ticket selecionado (`?t=id`)              → TicketDetalhe (servidor)
 */
export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const selected = t && Number.isFinite(Number(t)) ? Number(t) : null

  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const hoje = hojeSP()
  const days = 14
  const since = addDays(hoje, -days)

  const [{ data: users }, { data: opens }, { data: usage }, { data: abertos }, { data: reports }] = await Promise.all([
    pub.from('users').select('id, full_name, username, email, premium_status, total_points, current_streak, last_activity_date, onboarding_completed, target_exam, target_course, age, school_type, weekly_availability, created_at').limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    pub.from('ai_usage').select('user_id, feature, total_tokens, ok, cost_usd, created_at').gte('created_at', `${since}T00:00:00Z`).limit(50000),
    supabase.from('tickets').select('id, priority, status').in('status', ['new', 'triage', 'open', 'waiting_user']).limit(5000),
    supabase.from('reports').select('*').eq('kind', 'diario').order('created_at', { ascending: false }).limit(1),
  ])

  const hideList = (process.env.HIDE_USER_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const a = analisar((users ?? []) as unknown as AppUser[], (opens ?? []) as unknown as AppOpen[], (usage ?? []) as unknown as AiUsageRow[], { days, hoje, hideEmails: hideList })
  const alunos = resumirAlunos(carregarAlunos(), a.pessoas)

  const ab = (abertos ?? []) as { id: number; priority: string; status: string }[]
  const criticos = ab.filter((x) => x.priority === 'P0' || x.priority === 'P1').length
  const novos = ab.filter((x) => x.status === 'new').length
  const ativosHoje = a.pessoas.filter((p) => p.ultAb === hoje).length
  const primeiraVez = a.pessoas.filter((p) => p.ultAb === hoje && p.diasAt === 1).length
  const sumiram = a.pessoas
    .filter((p) => p.diasAt >= 2 && p.ultAb && diffDays(p.ultAb, hoje) >= 6)
    .sort((x, y) => y.pontos - x.pontos).slice(0, 5)

  const r = (reports ?? [])[0] as Report | undefined
  const rHoje = r && new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === hoje
  const dataLonga = new Date(`${hoje}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="grid h-full grid-cols-[300px_380px_minmax(0,1fr)]">
      {/* 1 · Hoje */}
      <div className="flex h-full flex-col gap-2.5 overflow-auto border-r bg-surface/40 px-3.5 py-4">
        <div className="font-display text-base font-extrabold">Hoje <span className="text-xs font-semibold text-fg2">· {dataLonga}</span></div>

        <div className="card border-brand" style={{ background: 'linear-gradient(135deg, rgb(var(--brand-soft)), rgb(var(--surface)))' }}>
          <div className="flex items-center gap-2"><span className="text-xl">🧠</span><div className="font-display font-extrabold">{rHoje ? 'Resumo da manhã' : 'Último resumo'}</div></div>
          {r ? (
            <>
              <div className="mt-1.5 text-xs text-fg2">{r.summary || r.title}</div>
              <div className="mt-2.5 flex gap-1.5">
                <Link href="/relatorios" className="clay h-8 text-xs">{r.spoken_at ? '▶ Ouvir de novo' : '▶ Ouvir'}</Link>
                <Link href="/relatorios" className="soft h-8 text-xs">Ler</Link>
              </div>
            </>
          ) : (
            <div className="mt-1.5 text-xs text-fg2">Nenhum resumo ainda. Gere um em Relatórios.</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Abertos" v={ab.length} foot={`${criticos} P0/P1 · ${novos} novos`} cor={criticos ? 'text-p0' : ''} />
          <Kpi label="Ativos hoje" v={ativosHoje} foot={`${primeiraVez} pela 1ª vez`} />
          <Kpi label="Hábito" v={a.kpis.habito} foot={`de ${a.total} · 14 dias`} cor="text-brandText" />
          <Kpi label="Beta c/ conta" v={alunos.comConta} foot={`${alunos.avisos.find((x) => x.tipo === 'Travou pra entrar no app')?.itens.length ?? 0} travaram`} />
        </div>

        <div className="card flex-1">
          <h3 className="card-h">Sumiram <span className="text-xs font-semibold text-muted">· 6+ dias</span></h3>
          {sumiram.length === 0 ? <p className="text-xs text-muted">Ninguém que voltava sumiu. 🎉</p> : (
            <div className="space-y-2">
              {sumiram.map((p) => (
                <Link key={p.id} href={`/alunos?u=${p.id}`} className="flex items-center gap-2 rounded-xl px-1 py-0.5 hover:bg-elev">
                  <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-brand font-display text-[11px] font-bold text-white">
                    {p.nome.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{p.nome}</span>
                    <span className="block text-[11px] text-muted">{GRUPO_META[p.grupo].tag} · há {p.ultAb ? diffDays(p.ultAb, hoje) : '?'} dias</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/alunos?f=sumiram" className="mt-3 inline-block text-xs text-brandText underline">Ver todos que sumiram →</Link>
        </div>
      </div>

      {/* 2 · lista */}
      <div className="h-full min-h-0 border-r"><FilaLista selected={selected} /></div>

      {/* 3 · detalhe */}
      <div className="h-full min-h-0 overflow-hidden">
        {selected ? <TicketDetalhe id={selected} /> : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-muted">
            <div className="text-4xl">🎫</div>
            <div className="font-display font-bold text-fg">Escolha um ticket na lista</div>
            <div className="max-w-[36ch] text-xs">Ele abre aqui do lado, com a conversa, a resposta e o contexto do aparelho. Nada sai desta tela.</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, v, foot, cor }: { label: string; v: number | string; foot?: string; cor?: string }) {
  return (
    <div className="card p-3">
      <div className="kicker">{label}</div>
      <div className={`font-display text-[28px] font-extrabold leading-none ${cor ?? ''}`}>{v}</div>
      {foot && <div className="mt-1 text-[11px] text-muted">{foot}</div>}
    </div>
  )
}
