import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { Conversas, type ConversaResumo, type Mensagem, type FilaResumo } from '@/components/whatsapp/Conversas'

export const dynamic = 'force-dynamic'

type Inbox = { id: number; telefone: string | null; nome: string | null; direcao: 'entrada' | 'saida'; corpo: string; tipo: string; user_id: string | null; recebido_em: string; lido_em: string | null }
type Out = { id: number; tipo: string; status: string; to_phone: string | null; corpo: string; criado_em: string; enviado_em: string | null; campanha: string | null }

/**
 * Conversas do WhatsApp do Duka (ponte com o Claude, migration 118): tudo que
 * entra e sai pelo número do bot, por pessoa, com a fila de envio e a chave
 * da ponte. Responder enfileira pro bot.
 */
export default async function ConversasPage({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const { tel = '' } = await searchParams
  const supabase = await supabaseServer()
  const pub = supabase.schema('public')

  const [{ data: inbox, error }, { data: out }, { data: cfg }] = await Promise.all([
    supabase.from('whatsapp_inbox').select('id, telefone, nome, direcao, corpo, tipo, user_id, recebido_em, lido_em').order('recebido_em', { ascending: false }).limit(2000),
    supabase.from('whatsapp_outbox').select('id, tipo, status, to_phone, corpo, criado_em, enviado_em, campanha').order('id', { ascending: false }).limit(1000),
    supabase.from('whatsapp_settings').select('ponte_claude, enabled').eq('id', 1).maybeSingle(),
  ])
  if (error) return <div className="p-6 text-sm text-muted">Não consegui ler <code>support.whatsapp_inbox</code>: {error.message}. A migration 118 está aplicada?</div>

  const I = (inbox ?? []) as Inbox[]
  const O = (out ?? []) as Out[]

  // contas ligadas
  const ids = [...new Set(I.map((m) => m.user_id).filter(Boolean))] as string[]
  const contas = new Map<string, { username: string | null; full_name: string | null }>()
  if (ids.length) {
    const { data: us } = await pub.from('users').select('id, username, full_name').in('id', ids)
    for (const u of (us ?? []) as { id: string; username: string | null; full_name: string | null }[]) contas.set(u.id, u)
  }

  // uma linha por telefone
  const porTel = new Map<string, ConversaResumo>()
  for (const m of I) {
    if (!m.telefone) continue
    const c = porTel.get(m.telefone) ?? { telefone: m.telefone, nome: null, conta: null, userId: null, ultima: m.recebido_em, ultimaCorpo: m.corpo, ultimaDirecao: m.direcao, naoLidas: 0, total: 0 }
    c.total++
    if (m.direcao === 'entrada' && !m.lido_em) c.naoLidas++
    if (!c.nome && m.nome) c.nome = m.nome
    if (!c.userId && m.user_id) { c.userId = m.user_id; const u = contas.get(m.user_id); c.conta = u?.username ?? null; if (!c.nome && u?.full_name) c.nome = u.full_name }
    porTel.set(m.telefone, c)
  }
  const lista = [...porTel.values()].sort((a, b) => b.ultima.localeCompare(a.ultima))

  // fila do bot por tipo/status (últimas 1000 linhas)
  const fila: FilaResumo[] = []
  const agg = new Map<string, FilaResumo>()
  for (const o of O) {
    const k = `${o.tipo}|${o.status}`
    const f = agg.get(k) ?? { tipo: o.tipo, status: o.status, n: 0, ultima: o.enviado_em ?? o.criado_em }
    f.n++; if ((o.enviado_em ?? o.criado_em) > f.ultima) f.ultima = o.enviado_em ?? o.criado_em
    agg.set(k, f)
  }
  fila.push(...[...agg.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.status.localeCompare(b.status)))

  // conversa aberta
  let mensagens: Mensagem[] = []
  let telAberto: string | null = null
  if (tel) {
    const { data: conv } = await supabase.rpc('conversa_whatsapp', { p_telefone: tel, p_limite: 120 })
    const rows = (conv ?? []) as { quando: string; de: string; corpo: string; tipo: string; origem: string }[]
    mensagens = rows.map((r) => ({ quando: r.quando, de: r.de, corpo: r.corpo, tipo: r.tipo, nossa: r.de.startsWith('nós') })).reverse()
    telAberto = tel.replace(/\D/g, '')
    if (telAberto.length === 11) telAberto = '55' + telAberto
    // pendentes na fila pra este número (ainda não enviadas, logo fora da conversa)
    for (const o of O) {
      if (o.status === 'queued' && o.to_phone && o.to_phone.replace(/\D/g, '').endsWith(telAberto.slice(2))) {
        mensagens.push({ quando: o.criado_em, de: `nós (${o.tipo}, na fila)`, corpo: o.corpo, tipo: 'chat', nossa: true, pendente: true })
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Conversas do WhatsApp</h1>
          <p className="text-xs text-muted">Tudo que entra e sai pelo número do Duka (bot). <Link href="/whatsapp" className="underline">Quem chegou pelo WhatsApp</Link></p>
        </div>
      </div>
      <Conversas lista={lista} mensagens={mensagens} telAberto={telAberto} fila={fila} ponte={!!cfg?.ponte_claude} botLigado={cfg?.enabled !== false} />
    </div>
  )
}
