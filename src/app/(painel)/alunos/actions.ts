'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Botão "Escanear agora" da mesa de alunos.
 *
 * Só registra o PEDIDO (support.alunos_scan_runs, status 'solicitado'). Quem
 * varre o WhatsApp é quem está com o WhatsApp Web aberto: o bot duka_whas_bot
 * (pega o pedido em até 30 s) ou a rotina "WhatsApp Duka Alunos Scan" (às 21h,
 * ou "Executar agora" no app do Claude). O painel pode estar no Railway, longe
 * do WhatsApp — por isso não tenta varrer sozinho.
 */
export async function solicitarScan(): Promise<{ ok: boolean; id?: number; erro?: string }> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('solicitar_scan_alunos', { p_origem: 'manual' })
  revalidatePath('/alunos')
  if (error) return { ok: false, erro: error.message }
  return { ok: true, id: Number(data) }
}
