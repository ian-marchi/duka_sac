'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import type { Report, ReportKind } from '@/lib/types'
import { REPORT_KIND_META } from '@/lib/types'
import { writeReportNote } from '@/lib/obsidian'
import { synthesize } from '@/lib/voice'

type Res<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

/** Chama a Edge Function report-generate com a sessão do admin e sincroniza a nota. */
export async function generateReport(kind: ReportKind, days?: number): Promise<Res<Report>> {
  const supabase = await supabaseServer()
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return { ok: false, error: 'sem sessão' }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/report-generate`
  let r: Response
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ kind, days: days ?? REPORT_KIND_META[kind].days }),
    })
  } catch (e) {
    return { ok: false, error: `rede: ${String(e)}` }
  }
  const out = await r.json().catch(() => ({}))
  if (!r.ok) return { ok: false, error: out?.error ?? `HTTP ${r.status}` }

  // a função devolve o registro parcial; relemos completo do banco
  const { data: full } = await supabase.from('reports').select('*').eq('id', out.id).single()
  const report = (full ?? out) as Report
  await syncOne(report)
  revalidatePath('/relatorios')
  return { ok: true, data: report }
}

async function syncOne(r: Report): Promise<boolean> {
  const abs = await writeReportNote(r)
  if (!abs) return false
  const supabase = await supabaseServer()
  await supabase.from('reports').update({ synced_at: new Date().toISOString() }).eq('id', r.id)
  return true
}

/** Escreve na vault todos os relatórios ainda não sincronizados (ex.: gerados pelo cron com o PC desligado). */
export async function syncPending(): Promise<Res<{ count: number }>> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('reports').select('*').is('synced_at', null)
    .order('created_at', { ascending: true }).limit(50)
  if (error) return { ok: false, error: error.message }
  let count = 0
  for (const r of (data ?? []) as Report[]) if (await syncOne(r)) count++
  revalidatePath('/relatorios')
  return { ok: true, data: { count } }
}

/** Regrava a nota de um relatório (ex.: depois do áudio existir). */
export async function resyncReport(id: number): Promise<Res> {
  const supabase = await supabaseServer()
  const { data } = await supabase.from('reports').select('*').eq('id', id).single()
  if (!data) return { ok: false, error: 'não encontrado' }
  await syncOne(data as Report)
  revalidatePath('/relatorios')
  return { ok: true }
}

/** Gera (ou reaproveita) o áudio do resumo executivo e devolve a URL pra tocar. */
export async function speakReport(id: number): Promise<Res<{ url: string }>> {
  const supabase = await supabaseServer()
  const { data } = await supabase.from('reports').select('*').eq('id', id).single()
  if (!data) return { ok: false, error: 'não encontrado' }
  const r = data as Report
  try {
    await synthesize(r.id, r.summary)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  await supabase.from('reports').update({ spoken_at: new Date().toISOString() }).eq('id', id)
  await syncOne(r)   // a nota ganha o embed do áudio
  revalidatePath('/relatorios')
  return { ok: true, data: { url: `/api/audio/${id}?t=${Date.now()}` } }
}
