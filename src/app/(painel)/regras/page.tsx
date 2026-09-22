import { supabaseServer } from '@/lib/supabase/server'
import type { PriorityRule } from '@/lib/types'
import { RulesEditor } from '@/components/RulesEditor'

export const dynamic = 'force-dynamic'

export default async function RegrasPage() {
  const supabase = await supabaseServer()
  const { data } = await supabase.from('priority_rules').select('*')
    .order('weight', { ascending: false })

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="mb-4 text-lg font-bold">Regras de prioridade</h1>
      <RulesEditor rules={(data ?? []) as PriorityRule[]} />
    </div>
  )
}
