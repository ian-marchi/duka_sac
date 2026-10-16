import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { EscolaAcoes } from '@/components/escolas/EscolaAcoes'

export const dynamic = 'force-dynamic'

export type EscolaRow = {
  id: string; nome: string; cidade: string | null; uf: string | null; status: 'ativa' | 'pausada' | 'encerrada'
  premium_ate: string | null; contato_nome: string | null; contato_telefone: string | null; contato_email: string | null; obs: string | null; criado_em: string
}
export type AlunoRow = {
  id: string; nome: string; email: string | null; telefone: string | null; user_id: string | null
  status: 'pendente' | 'conta' | 'premium' | 'removido'; convidado_em: string | null; criado_em: string
  conta?: { username: string | null; full_name: string | null; premium_status: string | null; premium_until: string | null; last_activity_date: string | null; premium_escola_id: string | null } | null
}

export default async function EscolaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await supabaseServer()
  const [{ data: escola }, { data: alunos }, { data: modelo }, { data: fila }] = await Promise.all([
    supabase.from('escolas').select('*').eq('id', id).maybeSingle(),
    supabase.from('escola_alunos').select('*').eq('escola_id', id).order('criado_em'),
    supabase.from('whatsapp_templates').select('corpo').eq('chave', 'escola:convite').maybeSingle(),
    supabase.from('whatsapp_outbox').select('to_phone, status, enviado_em, criado_em').eq('campanha', `escola:${id}`).order('id', { ascending: false }).limit(500),
  ])
  if (!escola) notFound()
  const E = escola as EscolaRow
  const A = (alunos ?? []) as AlunoRow[]

  const ids = A.map((a) => a.user_id).filter(Boolean) as string[]
  const contas = new Map<string, NonNullable<AlunoRow['conta']>>()
  if (ids.length) {
    const { data: us } = await supabase.schema('public').from('users')
      .select('id, username, full_name, premium_status, premium_until, last_activity_date, premium_escola_id').in('id', ids)
    for (const u of (us ?? []) as ({ id: string } & NonNullable<AlunoRow['conta']>)[]) contas.set(u.id, u)
  }
  for (const a of A) a.conta = a.user_id ? contas.get(a.user_id) ?? null : null

  // último envio da fila por telefone (pra mostrar "convite enviado em…")
  const envios = new Map<string, { status: string; quando: string }>()
  for (const f of (fila ?? []) as { to_phone: string; status: string; enviado_em: string | null; criado_em: string }[]) {
    if (!envios.has(f.to_phone)) envios.set(f.to_phone, { status: f.status, quando: f.enviado_em ?? f.criado_em })
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-3 text-[11px]"><Link href="/escolas" className="text-muted hover:underline">← Escolas</Link></div>
      <EscolaAcoes escola={E} alunos={A} modelo={(modelo as { corpo: string } | null)?.corpo ?? ''} envios={Object.fromEntries(envios)} />
    </div>
  )
}
