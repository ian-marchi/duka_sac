import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import type { Ticket, TicketKind } from '@/lib/types'
import { KIND_META } from '@/lib/types'
import { BarList } from '@/components/charts/BarList'
import { Sparkbars } from '@/components/charts/Sparkbars'
import { TokenUsage } from '@/components/TokenUsage'

export const dynamic = 'force-dynamic'

const PERIODS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>
}) {
  const { p = '30d' } = await searchParams
  const days = PERIODS[p] ?? 30
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const supabase = await supabaseServer()
  const { data: raw } = await supabase.from('tickets')
    .select('id, ref, kind, source, status, priority, title, occurrences, affected_users, ' +
            'app_version, created_at, resolved_at')
    .gte('created_at', since)
    .limit(5000)

  const rows = (raw ?? []) as unknown as Pick<Ticket,
    'id' | 'ref' | 'kind' | 'source' | 'status' | 'priority' | 'title' |
    'occurrences' | 'affected_users' | 'app_version' | 'created_at' | 'resolved_at'>[]

  // agregações em JS
  const novos = rows.length
  const abertos = rows.filter((r) => ['new', 'triage', 'open', 'waiting_user'].includes(r.status)).length
  const criticos = rows.filter((r) => r.priority === 'P0' || r.priority === 'P1').length
  const resolvidos = rows.filter((r) => r.status === 'resolved')
  const taxaResolucao = novos ? Math.round((resolvidos.length / novos) * 100) : 0

  const tempos = resolvidos
    .filter((r) => r.resolved_at)
    .map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3_600_000)
  const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0

  // por dia
  const byDay = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    byDay.set(d, 0)
  }
  rows.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + 1)
  })
  const daily = [...byDay.entries()].map(([day, value]) => ({ day, value }))
    .slice(-Math.min(days, 45))

  // por tipo
  const byKind = new Map<TicketKind, number>()
  rows.forEach((r) => byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1))
  const kinds = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: `${KIND_META[k].icon} ${KIND_META[k].label}`, value: v }))

  // por versão
  const byVer = new Map<string, number>()
  rows.forEach((r) => { if (r.app_version) byVer.set(r.app_version, (byVer.get(r.app_version) ?? 0) + 1) })
  const versoes = [...byVer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([label, value]) => ({ label: `v${label}`, value }))

  // top problemas
  const top = [...rows]
    .filter((r) => !['resolved', 'archived', 'wont_fix', 'duplicate'].includes(r.status))
    .sort((a, b) => b.affected_users - a.affected_users || b.occurrences - a.occurrences)
    .slice(0, 10)

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Métricas</h1>
        <div className="flex gap-1">
          {Object.keys(PERIODS).map((k) => (
            <Link
              key={k}
              href={`/metricas?p=${k}`}
              className={`rounded-lg px-3 py-1 text-sm ${p === k ? 'bg-brand text-white' : 'text-muted hover:bg-bg'}`}
            >
              {k}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tickets novos" value={novos} />
        <Stat label="Abertos agora" value={abertos} hint={`${criticos} P0/P1`} />
        <Stat label="Taxa de resolução" value={`${taxaResolucao}%`} />
        <Stat label="Tempo médio resolução" value={tempoMedio ? `${tempoMedio}h` : '—'} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Volume por dia">
          <Sparkbars data={daily} />
        </Card>
        <Card title="Por tipo">
          <BarList data={kinds} />
        </Card>
        <Card title="Por versão do app">
          <BarList data={versoes} />
        </Card>
        <Card title="Top problemas (por usuários afetados)">
          {top.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">Sem dados ainda.</div>
          ) : (
            <div className="space-y-1 text-sm">
              {top.map((r) => (
                <Link key={r.id} href={`/t/${r.id}`} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-bg">
                  <span className="font-mono text-xs text-muted">{r.ref}</span>
                  <span className="min-w-0 flex-1 truncate">{r.title || KIND_META[r.kind].label}</span>
                  <span className="shrink-0 text-xs text-muted">👥 {r.affected_users}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Os gráficos ficam úteis depois de ~2 semanas de dado acumulado. Não conclua nada com poucos tickets.
      </p>

      {/* Consumo de tokens de IA — independe do período de tickets acima */}
      <TokenUsage />
    </div>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}
