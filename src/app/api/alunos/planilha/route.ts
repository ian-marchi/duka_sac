import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { alunosDeLinhas, alunosParaCsv, carregarAlunos, type LinhaScan } from '@/lib/alunos'

export const dynamic = 'force-dynamic'

/** A planilha do WhatsApp em CSV (banco; se vazio, o arquivo manual). Só admin logado (RLS). */
export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('login', { status: 401 })

  const { data } = await supabase.from('alunos_whatsapp').select('*').order('nome').limit(10000)
  const base = data && data.length ? alunosDeLinhas(data as LinhaScan[]) : carregarAlunos()
  const csv = alunosParaCsv(base.alunos)
  const dia = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="alunos_whatsapp_${dia}.csv"`,
    },
  })
}
