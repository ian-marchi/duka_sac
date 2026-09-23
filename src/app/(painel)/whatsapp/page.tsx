import { supabaseServer } from '@/lib/supabase/server'
import type { AppUser, AppOpen } from '@/lib/types'
import { analisar, hojeSP, GRUPO_META } from '@/lib/analytics'
import { CANAL_LABEL } from '@/lib/alunos'
import type { PerfilResumo } from '@/components/PerfilPopup'
import { carregarAlunos, alunosDeLinhas, resumirAlunos, semAcento, type LinhaScan, type ScanRun, type ContatoWs } from '@/lib/alunos'
import { WhatsappResumo, WhatsappLista, filtrarWhatsapp } from '@/components/WhatsappWorkbench'

export const dynamic = 'force-dynamic'

/**
 * Aba "WhatsApp": só quem chegou pelo WhatsApp (a planilha do scan), como
 * métrica própria, separada das contas do app. Cada linha da planilha é uma
 * pessoa abordada; "no app" diz se ela já tem conta (ponte por telefone,
 * cruzamento em camadas ou nome).
 *   1. resumo: scan, totais, por escola, por ano, avisos
 *   2. lista com busca (`?q=`) e filtros (`?f=`)
 */
export default async function WhatsappPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const { f = 'todos', q = '' } = await searchParams
  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const hoje = hojeSP()

  const [{ data: users }, { data: opens }, { data: scanLinhas }, { data: scanRuns }, { data: contatos }] = await Promise.all([
    pub.from('users').select('id, full_name, username, email, premium_status, total_points, current_streak, last_activity_date, onboarding_completed, target_exam, target_course, age, school_type, weekly_availability, created_at, phone').limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    supabase.from('alunos_whatsapp').select('telefone, contato, nome, telefone_informado, escola_bruta, ano_bruto, status, observacao, cadastrado_no_bot, registrado_no_app, ultima_msg, atualizado_em').limit(10000),
    supabase.from('alunos_scan_runs').select('id, origem, status, solicitado_em, iniciado_em, concluido_em, total, erro').order('id', { ascending: false }).limit(5),
    supabase.from('contatos_whatsapp').select('user_id, telefone, escola, ano, como').limit(5000),
  ])

  const hideList = (process.env.HIDE_USER_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const a = analisar((users ?? []) as unknown as AppUser[], (opens ?? []) as unknown as AppOpen[], [], { days: 14, hoje, hideEmails: hideList })
  const linhas = (scanLinhas ?? []) as LinhaScan[]
  const telefones = new Map((users ?? []).map((u) => [String((u as { id: string }).id), ((u as { phone?: string | null }).phone ?? null)]))
  const ws = resumirAlunos(
    linhas.length ? { ...alunosDeLinhas(linhas), arquivo: 'support.alunos_whatsapp' } : carregarAlunos(),
    a.pessoas,
    { contatos: (contatos ?? []) as ContatoWs[], telefones },
  )
  const runs = (scanRuns ?? []) as ScanRun[]
  const scan = { ultimo: runs[0] ?? null, aberto: runs.find((r) => r.status === 'solicitado' || r.status === 'rodando') ?? null }

  const lista = filtrarWhatsapp(ws, f, semAcento(q))

  // O pop-up "No app": o perfil da conta ligada a cada linha (só o que o painel já mostra).
  const porId = new Map(a.pessoas.map((p) => [p.id, p]))
  const perfis: Record<string, PerfilResumo> = {}
  for (const al of ws.alunos) {
    const p = al.conta && porId.get(al.conta.id)
    if (!p || perfis[p.id]) continue
    const c = ws.contas[p.id]
    perfis[p.id] = {
      id: p.id, nome: p.nome, user: p.user, email: p.email, criado: p.criado, ultAb: p.ultAb, diasAt: p.diasAt, ab: p.ab,
      pontos: p.pontos, grupoTag: GRUPO_META[p.grupo].tag, grupoCor: GRUPO_META[p.grupo].cor,
      exame: p.exame, curso: p.curso, idade: p.idade, tipoEscola: p.escola === 'publica' ? 'pública' : p.escola === 'particular' ? 'particular' : null, ia: p.ia,
      escola: c?.escola ?? al.escola, ano: c?.ano ?? al.ano, canal: c ? CANAL_LABEL[c.canal] : 'WhatsApp', cidade: c?.cidade ?? null,
      contato: al.contato, obs: al.obs || null,
    }
  }

  return (
    <div className="grid h-full grid-cols-[340px_minmax(0,1fr)]">
      <WhatsappResumo ws={ws} scan={scan} f={f} />
      <div className="h-full min-h-0"><WhatsappLista ws={ws} alunos={lista} f={f} q={q} perfis={perfis} /></div>
    </div>
  )
}
