'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import type { Priority, TicketStatus } from '@/lib/types'

async function actor() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, email: user?.email ?? 'admin' }
}

export async function setStatus(id: number, status: TicketStatus, from: string) {
  const { supabase, email } = await actor()
  const patch: Record<string, unknown> = { status }
  if (status === 'resolved') patch.resolved_at = new Date().toISOString()
  const { error } = await supabase.from('tickets').update(patch).eq('id', id)
  if (error) return { error: error.message }
  await supabase.from('ticket_events').insert({
    ticket_id: id, actor: email, type: 'status', from_value: from, to_value: status,
  })
  revalidatePath(`/t/${id}`)
  return { ok: true }
}

export async function setPriority(id: number, priority: Priority, from: string) {
  const { supabase, email } = await actor()
  // priority_source='manual' congela o motor automático para este ticket
  const { error } = await supabase.from('tickets')
    .update({ priority, priority_source: 'manual' }).eq('id', id)
  if (error) return { error: error.message }
  await supabase.from('ticket_events').insert({
    ticket_id: id, actor: email, type: 'priority', from_value: from, to_value: priority,
  })
  revalidatePath(`/t/${id}`)
  return { ok: true }
}

export async function saveNote(id: number, note: string) {
  const { supabase } = await actor()
  const { error } = await supabase.from('tickets').update({ internal_note: note }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/t/${id}`)
  return { ok: true }
}

export async function addTag(id: number, tags: string[]) {
  const { supabase } = await actor()
  const { error } = await supabase.from('tickets').update({ tags }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/t/${id}`)
  return { ok: true }
}

// Enfileira a resposta e chama a Edge Function ticket-reply para o envio.
export async function sendReply(id: number, toEmail: string, subject: string, body: string) {
  const { supabase, email } = await actor()

  const { data: reply, error } = await supabase.from('ticket_replies').insert({
    ticket_id: id, to_email: toEmail, subject, body, sent_by: email,
  }).select('id').single()
  if (error || !reply) return { error: error?.message ?? 'falha ao enfileirar' }

  // dispara o envio (a função valida que quem chama é admin pelo próprio JWT)
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ticket-reply`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ reply_id: reply.id }),
    })
    if (!res.ok) {
      const out = await res.json().catch(() => ({}))
      // a resposta ficou 'queued'/'failed' no banco; informamos mas não perdemos
      revalidatePath(`/t/${id}`)
      return { error: out?.error ?? 'e-mail não enviado (resposta salva na fila)' }
    }
  } catch (e) {
    revalidatePath(`/t/${id}`)
    return { error: `envio falhou: ${String(e)} (resposta salva na fila)` }
  }

  // marca o ticket como aguardando o usuário
  await supabase.from('tickets').update({ status: 'waiting_user' }).eq('id', id)
  revalidatePath(`/t/${id}`)
  return { ok: true }
}
