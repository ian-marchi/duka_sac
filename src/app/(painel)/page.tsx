import { supabaseServer } from '@/lib/supabase/server'
import type { AppUser, AppOpen, AiUsageRow, TicketStatus } from '@/lib/types'
import { STATUS_GROUPS } from '@/lib/types'
import { analisar, addDays, diffDays, hojeSP } from '@/lib/analytics'
import type { Bruto } from '@/lib/serieTempo'
import { carregarAlunos, resumirAlunos } from '@/lib/alunos'
import { VisaoGeral } from '@/components/VisaoGeral'
import { AlunosBeta } from '@/components/AlunosBeta'
import type { TicketCurto, FilaResumo, Lider } from '@/components/dash/Blocos'

export const dynamic = 'force-dynamic'

const PERIODOS: Record<string, number> = { '1d': 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90 }
const DATA = /^\d{4}-\d{2}-\d{2}$/
const COR_FILA: Record<string, string> = { novos: 'rgb(var(--brand))', abertos: 'rgb(var(--p1))', aguardando: 'rgb(var(--p2))' }

// Home = visão geral do app (dashboard). A fila de tickets mora em /tickets.
// Período: ?p=1d (diário = hoje)|7d|14d|30d|90d ou intervalo livre ?de=AAAA-MM-DD&ate=AAAA-MM-DD.
export default async function VisaoGeralPage({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string; todos?: string }> }) {
  const sp = await searchParams
  const hoje = hojeSP()

  // intervalo livre vale quando as duas datas são válidas; senão, período pronto
  let de: string, ate: string, periodo: string | null
  if (sp.de && sp.ate && DATA.test(sp.de) && DATA.test(sp.ate) && sp.de <= sp.ate) {
    ate = sp.ate > hoje ? hoje : sp.ate
    de = sp.de > ate ? ate : sp.de
    periodo = null
  } else {
    periodo = sp.p && PERIODOS[sp.p] ? sp.p : '14d'
    ate = hoje
    de = addDays(hoje, -(PERIODOS[periodo] - 1))
  }
  const days = diffDays(de, ate) + 1
  const since = addDays(de, -1)

  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const [{ data: users, error: uErr }, { data: opens }, { data: usage }, { data: ultimos }, { data: abertos }] = await Promise.all([
    pub.from('users').select(
      'id, full_name, username, email, premium_status, total_points, current_streak, last_activity_date, ' +
      'onboarding_completed, target_exam, target_course, age, school_type, weekly_availability, created_at, avatar_url',
    ).limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    pub.from('ai_usage').select('user_id, feature, total_tokens, ok, cost_usd, created_at')
      .gte('created_at', `${since}T00:00:00Z`).lt('created_at', `${addDays(ate, 1)}T00:00:00Z`).limit(50000),
    supabase.from('tickets').select('id, ref, apelido, title, message, kind, status, priority, created_at, reporter_name')
      .order('created_at', { ascending: false }).limit(7),
    supabase.from('tickets').select('status').in('status', ['new', 'triage', 'open', 'waiting_user']).limit(5000),
  ])

  if (uErr) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted">
          Não consegui ler <code>public.users</code>: {uErr.message}. Confira se a migration
          <code> 081</code> (policies <code>users_select_admin</code> / <code>app_opens_select_admin</code>) foi aplicada.
        </div>
      </div>
    )
  }

  const todosUsers = (users ?? []) as unknown as (AppUser & { avatar_url: string | null })[]
  const hideList = (process.env.HIDE_USER_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const showAll = sp.todos === '1'
  const ehTeste = (u: AppUser) => !!u.email && hideList.includes(u.email.toLowerCase())
  const hidden = showAll ? 0 : todosUsers.filter(ehTeste).length
  const opensAte = ((opens ?? []) as unknown as AppOpen[]).filter((o) => o.dia <= ate)

  const a = analisar(todosUsers, opensAte, (usage ?? []) as unknown as AiUsageRow[], {
    days, hoje: ate, hideEmails: showAll ? [] : hideList,
  })
  // "hoje" real para os cartões de hoje/semana/mês, mesmo com intervalo no passado
  a.hoje = hoje

  // série crua e compacta para os gráficos do navegador (sem contas de teste)
  const visiveis = todosUsers.filter((u) => showAll || !ehTeste(u))
  const idx = new Map(visiveis.map((u, i) => [u.id, i]))
  const bruto: Bruto = {
    criados: visiveis.map((u) => new Date(u.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })),
    opens: ((opens ?? []) as unknown as AppOpen[])
      .filter((o) => idx.has(o.user_id))
      .map((o) => [o.dia, idx.get(o.user_id)!, o.aberturas] as [string, number, number]),
  }

  const lideres: Lider[] = [...visiveis]
    .filter((u) => (u.total_points ?? 0) > 0)
    .sort((x, y) => (y.total_points ?? 0) - (x.total_points ?? 0))
    .slice(0, 5)
    .map((u) => ({
      id: u.id, nome: u.full_name?.trim() || u.username || 'sem nome', user: u.username,
      pontos: u.total_points ?? 0, ofensiva: u.current_streak ?? 0, avatar: u.avatar_url,
    }))

  const st = (abertos ?? []) as { status: TicketStatus }[]
  const fila: FilaResumo = STATUS_GROUPS.filter((g) => COR_FILA[g.key]).map((g) => ({
    key: g.key, label: g.label, cor: COR_FILA[g.key], n: st.filter((x) => g.statuses.includes(x.status)).length,
  }))

  // Planilha dos alunos abordados no WhatsApp — fonte separada, cruzada por nome.
  const alunos = resumirAlunos(carregarAlunos(), a.pessoas)

  return (
    <>
      <VisaoGeral
        a={a} bruto={bruto} de={de} ate={ate} periodo={periodo} showAll={showAll} hidden={hidden}
        tickets={(ultimos ?? []) as TicketCurto[]} fila={fila} lideres={lideres}
      />
      <AlunosBeta r={alunos} />
    </>
  )
}
