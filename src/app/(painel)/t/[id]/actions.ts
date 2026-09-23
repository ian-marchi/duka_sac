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

// LEGADO: resposta por e-mail (Edge ticket-reply). A UI não usa mais — o
// painel responde só pelo WhatsApp (enviarWhatsapp, abaixo).
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

// ── Resposta pelo WhatsApp (migration 091) ───────────────────────────────────
// O painel não manda nada: só grava em support.whatsapp_outbox. 'draft' fica
// parado como rascunho (o bot ignora); 'queued' o bot duka_whas_bot envia.

// só dígitos, com 55 na frente (mesma regra de support.normaliza_telefone)
function normalizaTelefone(p: string): string | null {
  const d = p.replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

async function aguardandoAluno(supabase: Awaited<ReturnType<typeof supabaseServer>>, ticketId: number, email: string) {
  const { data: t } = await supabase.from('tickets').select('status').eq('id', ticketId).single()
  if (!t || t.status === 'waiting_user') return
  await supabase.from('tickets').update({ status: 'waiting_user' }).eq('id', ticketId)
  await supabase.from('ticket_events').insert({
    ticket_id: ticketId, actor: email, type: 'status', from_value: t.status, to_value: 'waiting_user',
  })
}

export async function enviarWhatsapp(ticketId: number, phone: string, corpo: string, status: 'draft' | 'queued') {
  const { supabase, email } = await actor()
  const texto = corpo.trim()
  if (!texto) return { error: 'mensagem vazia' }
  const fone = normalizaTelefone(phone)
  if (status === 'queued' && !fone) return { error: 'sem número de WhatsApp' }

  const { data: t, error: e1 } = await supabase.from('tickets').select('user_id').eq('id', ticketId).single()
  if (e1 || !t) return { error: e1?.message ?? 'ticket não encontrado' }

  const { error } = await supabase.from('whatsapp_outbox').insert({
    ticket_id: ticketId, user_id: t.user_id, tipo: 'manual', to_phone: fone, corpo: texto, status,
  })
  if (error) return { error: error.message }

  await supabase.from('ticket_events').insert({
    ticket_id: ticketId, actor: email, type: 'whatsapp',
    to_value: status === 'draft' ? 'rascunho' : 'na fila', body: texto,
  })
  if (status === 'queued') await aguardandoAluno(supabase, ticketId, email)
  revalidatePath('/tickets')
  return { ok: true }
}

export async function liberarWhatsapp(outboxId: number) {
  const { supabase, email } = await actor()
  const { data: l } = await supabase.from('whatsapp_outbox')
    .select('ticket_id, to_phone, status').eq('id', outboxId).single()
  if (!l) return { error: 'mensagem não encontrada' }
  if (l.status !== 'draft') return { error: 'só rascunho pode ser liberado' }
  if (!l.to_phone) return { error: 'rascunho sem número — descarte e escreva de novo com o número' }

  const { error } = await supabase.from('whatsapp_outbox')
    .update({ status: 'queued' }).eq('id', outboxId).eq('status', 'draft')
  if (error) return { error: error.message }
  if (l.ticket_id) {
    await supabase.from('ticket_events').insert({
      ticket_id: l.ticket_id, actor: email, type: 'whatsapp', from_value: 'rascunho', to_value: 'na fila',
    })
    await aguardandoAluno(supabase, l.ticket_id, email)
  }
  revalidatePath('/tickets')
  return { ok: true }
}

export async function descartarWhatsapp(outboxId: number) {
  const { supabase, email } = await actor()
  const { data: l, error } = await supabase.from('whatsapp_outbox')
    .update({ status: 'skipped', erro: 'descartada' }).eq('id', outboxId).eq('status', 'draft')
    .select('ticket_id').maybeSingle()
  if (error) return { error: error.message }
  if (!l) return { error: 'só rascunho pode ser descartado' }
  if (l.ticket_id) {
    await supabase.from('ticket_events').insert({
      ticket_id: l.ticket_id, actor: email, type: 'whatsapp', from_value: 'rascunho', to_value: 'descartada',
    })
  }
  revalidatePath('/tickets')
  return { ok: true }
}
