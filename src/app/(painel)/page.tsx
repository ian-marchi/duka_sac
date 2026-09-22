import { supabaseServer } from '@/lib/supabase/server'
import type { AppUser, AppOpen, AiUsageRow } from '@/lib/types'
import { analisar, addDays, hojeSP } from '@/lib/analytics'
import { carregarAlunos, resumirAlunos } from '@/lib/alunos'
import { VisaoGeral } from '@/components/VisaoGeral'
import { AlunosBeta } from '@/components/AlunosBeta'

export const dynamic = 'force-dynamic'

const PERIODOS: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }

// Home = visão geral do app. A fila de tickets mora em /tickets.
export default async function VisaoGeralPage({ searchParams }: { searchParams: Promise<{ p?: string; todos?: string }> }) {
  const { p = '14d', todos } = await searchParams
  const days = PERIODOS[p] ?? 14
  const hoje = hojeSP()
  const since = addDays(hoje, -days)

  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const [{ data: users, error: uErr }, { data: opens }, { data: usage }] = await Promise.all([
    pub.from('users').select(
      'id, full_name, username, email, premium_status, total_points, current_streak, last_activity_date, ' +
      'onboarding_completed, target_exam, target_course, age, school_type, weekly_availability, created_at',
    ).limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    pub.from('ai_usage').select('user_id, feature, total_tokens, ok, cost_usd, created_at')
      .gte('created_at', `${since}T00:00:00Z`).limit(50000),
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

  const hideList = (process.env.HIDE_USER_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const showAll = todos === '1'
  const a = analisar(
    (users ?? []) as unknown as AppUser[],
    (opens ?? []) as unknown as AppOpen[],
    (usage ?? []) as unknown as AiUsageRow[],
    { days, hoje, hideEmails: showAll ? [] : hideList },
  )
  const hidden = showAll ? 0 : ((users ?? []) as unknown as AppUser[]).filter((u) => u.email && hideList.map((e) => e.toLowerCase()).includes(u.email.toLowerCase())).length

  // Planilha dos alunos abordados no WhatsApp (data/alunos_duka.csv) — fonte
  // separada, mantida à mão; o cruzamento com as contas é por nome.
  const alunos = resumirAlunos(carregarAlunos(), a.pessoas)

  return (
    <>
      <VisaoGeral a={a} periodos={Object.keys(PERIODOS)} periodo={p} showAll={showAll} hidden={hidden} />
      <AlunosBeta r={alunos} />
    </>
  )
}
