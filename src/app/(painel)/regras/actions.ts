'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import type { Priority } from '@/lib/types'

export async function toggleRule(id: string, enabled: boolean) {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('priority_rules').update({ enabled }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/regras')
  return { ok: true }
}

export async function updateRule(id: string, patch: {
  priority?: Priority
  weight?: number
  min_users?: number | null
  min_occurs?: number | null
  match_words?: string[] | null
}) {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('priority_rules').update(patch).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/regras')
  return { ok: true }
}

// Simula qual prioridade um texto receberia — sem gravar nada.
export async function testText(text: string): Promise<{ priority: string; reasons: string[] }> {
  const supabase = await supabaseServer()
  const { data: rules } = await supabase.from('priority_rules')
    .select('*').eq('enabled', true).order('weight', { ascending: false })

  const hay = text.toLowerCase()
  const rank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  let priority = 'P2'
  let best = -1
  const reasons: string[] = []

  for (const r of rules ?? []) {
    if (r.match_words && !r.match_words.some((w: string) => hay.includes(w.toLowerCase()))) continue
    if (r.min_users || r.min_occurs || r.premium_only) continue // sem contexto no teste de texto
    if (r.match_kind) continue // teste é só de texto livre
    reasons.push(r.id)
    if (r.weight > best) { best = r.weight; priority = r.priority }
  }
  if (!reasons.length) reasons.push('default_p2')
  return { priority, reasons }
}
