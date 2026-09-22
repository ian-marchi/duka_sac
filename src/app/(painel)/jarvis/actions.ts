'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { synthesizeBytes, voiceStatus } from '@/lib/voice'

export type JarvisTurn = { role: 'user' | 'assistant'; content: string }

export type JarvisAnswer =
  | { ok: true; text: string; audio?: string; tools: string[] }
  | { ok: false; error: string }

/**
 * Pergunta ao JARVIS (Edge Function jarvis-chat, com ferramentas) e, se o
 * sidecar de voz estiver online, já devolve o áudio da resposta em data URL.
 */
export async function askJarvis(question: string, history: JarvisTurn[], wantAudio = true): Promise<JarvisAnswer> {
  const q = question.trim()
  if (!q) return { ok: false, error: 'pergunta vazia' }

  const supabase = await supabaseServer()
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return { ok: false, error: 'sem sessão' }

  let r: Response
  try {
    r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/jarvis-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ question: q, history: history.slice(-10) }),
    })
  } catch (e) {
    return { ok: false, error: `rede: ${String(e)}` }
  }
  const out = await r.json().catch(() => ({}))
  if (!r.ok) return { ok: false, error: out?.error ?? `HTTP ${r.status}` }

  const text = String(out.answer ?? '').trim()
  let audio: string | undefined
  if (wantAudio && text) {
    try {
      if ((await voiceStatus()).online) {
        const buf = await synthesizeBytes(text)
        audio = `data:audio/wav;base64,${buf.toString('base64')}`
      }
    } catch { /* sem voz: devolve só o texto */ }
  }
  return { ok: true, text, audio, tools: Array.isArray(out.tools_used) ? out.tools_used : [] }
}
