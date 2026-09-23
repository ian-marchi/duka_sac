import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import type { AiUsageByUser, AiUsageByFeature } from '@/lib/types'
import { featureLabel } from '@/lib/types'
import { compactNumber, fullNumber, timeAgo } from '@/lib/format'
import { BarList } from '@/components/charts/BarList'

// Consumo de tokens de IA. Depende da migration 047 (views ai_usage_*) e da
// policy ai_usage_select_admin (migration 051) que deixa o admin ver tudo.
export async function TokenUsage() {
  const supabase = await supabaseServer()
  const pub = supabase.schema('public')

  const [{ data: usersRaw, error: uErr }, { data: featRaw }] = await Promise.all([
    pub.from('ai_usage_por_usuario').select('*').limit(1000),
    pub.from('ai_usage_por_recurso').select('*'),
  ])

  // A view não existe (migration 047 não aplicada) ou o admin não tem acesso.
  if (uErr) {
    return (
      <Section>
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted">
          Não consegui ler o consumo de tokens. Confira se a migration <code>047_ai_usage</code>{' '}
          e a policy <code>ai_usage_select_admin</code> (migration 051) foram aplicadas, e se
          o schema <code>public</code> está exposto no PostgREST.
        </div>
      </Section>
    )
  }

  const users = (usersRaw ?? []) as AiUsageByUser[]
  const features = (featRaw ?? []) as AiUsageByFeature[]

  if (users.length === 0) {
    return (
      <Section>
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted">
          Nenhum consumo de IA registrado ainda.
        </div>
      </Section>
    )
  }

  // Totais globais
  const totalTokens = users.reduce((a, u) => a + (u.tokens_total ?? 0), 0)
  const totalMes = users.reduce((a, u) => a + (u.tokens_mes ?? 0), 0)
  const totalChamadas = users.reduce((a, u) => a + (u.chamadas ?? 0), 0)
  const nUsers = users.length
  const mediaPorUsuario = nUsers ? Math.round(totalTokens / nUsers) : 0

  // Top 10 (a view já vem ordenada por tokens_total desc, mas garantimos)
  const top = [...users].sort((a, b) => b.tokens_total - a.tokens_total).slice(0, 10)

  // "Por que" cada top-10 gastou: breakdown por feature buscando o cru desses users.
  const topIds = top.map((u) => u.user_id)
  const { data: rowsRaw } = await pub
    .from('ai_usage')
    .select('user_id, feature, total_tokens')
    .in('user_id', topIds)
    .limit(20000)

  const perUser = new Map<string, Map<string, number>>()
  for (const r of (rowsRaw ?? []) as { user_id: string; feature: string; total_tokens: number }[]) {
    const m = perUser.get(r.user_id) ?? new Map<string, number>()
    m.set(r.feature, (m.get(r.feature) ?? 0) + (r.total_tokens ?? 0))
    perUser.set(r.user_id, m)
  }
  const whyFor = (userId: string): string => {
    const m = perUser.get(userId)
    if (!m) return '—'
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
    const [top1, top2] = sorted
    if (!top1) return '—'
    const parts = [top1, top2].filter(Boolean).map(([f, v]) =>
      `${featureLabel(f)} (${Math.round((v / (top.find((u) => u.user_id === userId)?.tokens_total || 1)) * 100)}%)`)
    return parts.join(' · ')
  }

  // "Para onde vão os tokens" — global por recurso
  const featureBars = features
    .reduce((acc, f) => {
      const cur = acc.find((x) => x.key === f.recurso)
      if (cur) cur.value += f.tokens_total
      else acc.push({ key: f.recurso, value: f.tokens_total })
      return acc
    }, [] as { key: string; value: number }[])
    .sort((a, b) => b.value - a.value)
    .map((x) => ({ label: featureLabel(x.key), value: x.value }))

  return (
    <Section>
      {/* cartões */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tokens totais" value={compactNumber(totalTokens)} hint={`${fullNumber(totalTokens)} tokens`} />
        <Stat label="Média por usuário" value={compactNumber(mediaPorUsuario)} hint={`${nUsers} usuários ativos`} />
        <Stat label="Tokens este mês" value={compactNumber(totalMes)} />
        <Stat label="Chamadas de IA" value={fullNumber(totalChamadas)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* top 10 */}
        <div className="rounded-2xl border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Top 10 — quem mais gastou tokens</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted">
                  <th className="p-1.5">#</th>
                  <th className="p-1.5">Usuário</th>
                  <th className="p-1.5 text-right">Tokens</th>
                  <th className="p-1.5 text-right">Chamadas</th>
                  <th className="p-1.5">Principal uso (por quê)</th>
                  <th className="p-1.5 text-right">Última</th>
                </tr>
              </thead>
              <tbody>
                {top.map((u, i) => {
                  const share = totalTokens ? Math.round((u.tokens_total / totalTokens) * 100) : 0
                  return (
                    <tr key={u.user_id} className="border-b align-top">
                      <td className="p-1.5 font-mono text-xs text-muted">{i + 1}</td>
                      <td className="p-1.5">
                        <div className="font-medium">{u.username || u.email || u.user_id.slice(0, 8)}</div>
                        <div className="text-xs text-muted">
                          {u.email}
                        </div>
                      </td>
                      <td className="p-1.5 text-right">
                        <div className="font-mono font-semibold">{compactNumber(u.tokens_total)}</div>
                        <div className="text-xs text-muted">{share}% do total</div>
                      </td>
                      <td className="p-1.5 text-right font-mono text-xs">
                        {fullNumber(u.chamadas)}
                        {u.chamadas_com_erro > 0 && (
                          <div className="text-p1">{u.chamadas_com_erro} c/ erro</div>
                        )}
                      </td>
                      <td className="max-w-[220px] p-1.5 text-xs text-muted">{whyFor(u.user_id)}</td>
                      <td className="p-1.5 text-right text-xs text-muted">
                        {u.ultima_chamada ? timeAgo(u.ultima_chamada) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            &ldquo;Por quê&rdquo; = as funções de IA onde o usuário mais gastou (fatia do consumo dele).
          </p>
        </div>

        {/* por recurso */}
        <div className="rounded-2xl border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Para onde vão os tokens</h3>
          <BarList data={featureBars} format={compactNumber} />
          <p className="mt-3 text-xs text-muted">
            Raio-x global por função. Útil pra decidir onde cortar prompt ou baixar max_tokens.
          </p>
        </div>
      </div>
    </Section>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-bold">Consumo de IA (tokens)</h2>
      {children}
    </section>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  )
}
