'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Conversas do WhatsApp (ponte, migration 118). O painel não manda nada
 * direto: responder = enfileirar em support.whatsapp_outbox (tipo 'manual',
 * campanha 'painel'); o bot envia quando o Ian libera com !fila enviar (ou na
 * hora, se o OUTBOX_MODE do bot for 'auto').
 */

type R = { ok: boolean; erro?: string }

export async function setPonte(on: boolean): Promise<R> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('whatsapp_settings').update({ ponte_claude: on }).eq('id', 1)
  revalidatePath('/whatsapp/conversas')
  return error ? { ok: false, erro: error.message } : { ok: true }
}

export async function marcarLidas(telefone: string): Promise<R> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('whatsapp_inbox').update({ lido_em: new Date().toISOString() })
    .eq('telefone', telefone).eq('direcao', 'entrada').is('lido_em', null)
  revalidatePath('/whatsapp/conversas')
  return error ? { ok: false, erro: error.message } : { ok: true }
}

export async function responder(telefone: string, corpo: string): Promise<R> {
  const texto = corpo.trim()
  if (!texto) return { ok: false, erro: 'Mensagem vazia.' }
  if (!/^55\d{11}$/.test(telefone)) return { ok: false, erro: 'Telefone inválido.' }
  const supabase = await supabaseServer()
  const { error } = await supabase.from('whatsapp_outbox').insert({
    tipo: 'manual', to_phone: telefone, corpo: texto, status: 'queued', campanha: 'painel',
  })
  if (!error) {
    await supabase.from('whatsapp_inbox').update({ lido_em: new Date().toISOString() })
      .eq('telefone', telefone).eq('direcao', 'entrada').is('lido_em', null)
  }
  revalidatePath('/whatsapp/conversas')
  return error ? { ok: false, erro: error.message } : { ok: true }
}
