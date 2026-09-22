import { supabaseServer } from '@/lib/supabase/server'
import type { Report } from '@/lib/types'
import { ReportsPanel } from '@/components/ReportsPanel'
import { voiceStatus } from '@/lib/voice'
import { vaultPath } from '@/lib/obsidian'
import { hojeSP } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export default async function RelatoriosPage() {
  const supabase = await supabaseServer()
  const [{ data }, voice] = await Promise.all([
    supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(60),
    voiceStatus(),
  ])
  const reports = (data ?? []) as Report[]
  const pendingSync = reports.filter((r) => !r.synced_at).length

  // resumo diário de hoje (fuso SP) ainda não ouvido → banner "bom dia"
  const hoje = hojeSP()
  const morning = reports.find((r) =>
    r.kind === 'diario' && !r.spoken_at &&
    new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === hoje) ?? null

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold">JARVIS · Relatórios</h1>
        <p className="text-xs text-muted">
          Gerados pelo modelo a partir do dossiê numérico do banco. Cada um vira uma nota no Obsidian
          e o resumo executivo pode ser ouvido em voz alta.
        </p>
      </div>
      <ReportsPanel
        reports={reports}
        voiceOnline={voice.online}
        vaultOk={!!vaultPath()}
        pendingSync={pendingSync}
        morning={morning}
      />
    </div>
  )
}
