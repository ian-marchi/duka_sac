import { supabaseServer } from '@/lib/supabase/server'
import type { AppUser, AppOpen, AiUsageRow } from '@/lib/types'
import { analisar, addDays, hojeSP, GRUPO_META } from '@/lib/analytics'
import { alunosDeLinhas, resumirAlunos, escolaCurta, type LinhaScan, type ContatoWs, type OrigemManual } from '@/lib/alunos'
import { carregarAlunos } from '@/lib/alunosCsv'
import { relatoriosBase, detalheAluno, type SimRow, type EssayRow, type TicketLite, type FontesAparelho } from '@/lib/alunosAnalise'
import { canalCurto, type UserDevice, type PushTokenLite } from '@/lib/aparelho'
import { RelatoriosColuna, AlunoDetalheView } from '@/components/AlunosWorkbench'
import { AlunosTabela, type LinhaAluno } from '@/components/AlunosTabela'

export const dynamic = 'force-dynamic'

/**
 * Mesa de alunos (desenho F, revisto em 12/10/2026):
 *   1. os três relatórios da base inteira (de onde vêm, frequência, uso)
 *   2. a TABELA das contas com a cara da planilha do WhatsApp: escola, ano, canal
 *      (App Store / Play Store / Beta), o que aconteceu no WhatsApp, quando entrou
 *      no app, 1ª mensagem e último aviso, último uso — tudo com filtro tipo Excel
 *   3. os mesmos três relatórios só do aluno selecionado (`?u=id`)
 */
export default async function AlunosPage({ searchParams }: { searchParams: Promise<{ u?: string; q?: string }> }) {
  const { u = null, q = '' } = await searchParams
  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const hoje = hojeSP()
  const days = 14
  const since = addDays(hoje, -days)

  const [{ data: users, error: uErr }, { data: opens }, { data: usage }, { data: sims }, { data: essays }, { data: tickets }, { data: scanLinhas }, { data: contatos }, { data: origens }, { data: devices }, { data: pushes }, { data: avisos }] = await Promise.all([
    pub.from('users').select('id, full_name, username, email, premium_status, total_points, current_streak, last_activity_date, onboarding_completed, target_exam, target_course, age, school_type, weekly_availability, created_at, phone, phone_verified_at').limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    pub.from('ai_usage').select('user_id, feature, total_tokens, ok, cost_usd, created_at').gte('created_at', `${since}T00:00:00Z`).limit(50000),
    // 113: o admin passou a enxergar simulations/essays (antes vinha vazio e o card dizia 0 pra todo mundo)
    pub.from('simulations').select('user_id, total_questions, correct_answers, status, started_at, points_earned, type, exam, subject').limit(20000),
    pub.from('essays').select('user_id, created_at').limit(20000),
    supabase.from('tickets').select('id, ref, apelido, title, priority, status, user_id, created_at, platform, os_version, device_model, app_version').limit(5000),
    // planilha do WhatsApp (migration 089): o que o scan gravou
    supabase.from('alunos_whatsapp').select('telefone, contato, nome, telefone_informado, escola_bruta, ano_bruto, status, observacao, cadastrado_no_bot, registrado_no_app, primeira_msg, ultima_msg, atualizado_em').limit(10000),
    supabase.from('contatos_whatsapp').select('user_id, telefone, escola, ano, como').limit(5000),
    supabase.from('alunos_origem').select('user_id, canal, escola, ano, cidade, estado, curso, observacao').limit(5000),
    // aparelho atual de cada conta (migration 100) + versão de quem aceitou push (fallback)
    pub.from('user_devices').select('user_id, platform, os_version, device_model, device_id, device_name, app_version, build, runtime_version, canal, updates_channel, first_seen_at, updated_at').limit(5000),
    pub.from('push_tokens').select('user_id, platform, app_version, updated_at').limit(5000),
    // avisos que o bot já mandou (fila do WhatsApp): o último enviado por conta
    supabase.from('whatsapp_outbox').select('user_id, tipo, enviado_em').eq('status', 'sent').not('user_id', 'is', null).limit(10000),
  ])
  if (uErr) {
    return <div className="p-6 text-sm text-muted">Não consegui ler <code>public.users</code>: {uErr.message}</div>
  }

  const hideList = (process.env.HIDE_USER_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const a = analisar((users ?? []) as unknown as AppUser[], (opens ?? []) as unknown as AppOpen[], (usage ?? []) as unknown as AiUsageRow[], { days, hoje, hideEmails: hideList })
  // Banco primeiro; se o scan nunca rodou, o CSV manual segura a tela.
  const linhas = (scanLinhas ?? []) as LinhaScan[]
  const telefones = new Map((users ?? []).map((u) => [String((u as { id: string }).id), ((u as { phone?: string | null }).phone ?? null)]))
  const ws = resumirAlunos(
    linhas.length ? { ...alunosDeLinhas(linhas), arquivo: 'support.alunos_whatsapp' } : carregarAlunos(),
    a.pessoas,
    { contatos: (contatos ?? []) as ContatoWs[], telefones, origens: (origens ?? []) as OrigemManual[] },
  )
  const simsR = (sims ?? []) as SimRow[]
  const essR = (essays ?? []) as EssayRow[]
  const tkR = (tickets ?? []) as TicketLite[]
  const opensR = (opens ?? []) as AppOpen[]
  const usageR = (usage ?? []) as AiUsageRow[]

  const base = relatoriosBase(a, opensR, usageR, simsR, essR, ws)
  const wsPorConta = new Map(ws.alunos.filter((al) => al.conta).map((al) => [al.conta!.id, al]))

  // Fontes do card "Aparelho e contato": user_devices > push_tokens (o mais
  // recente por conta) > tickets. Telefone: cadastro do app, senão a ponte do WhatsApp.
  const pushPorConta = new Map<string, PushTokenLite>()
  for (const t of (pushes ?? []) as PushTokenLite[]) {
    const atual = pushPorConta.get(t.user_id)
    if (!atual || (t.updated_at ?? '') > (atual.updated_at ?? '')) pushPorConta.set(t.user_id, t)
  }
  const telefonesWs = new Map<string, string>()
  for (const c of (contatos ?? []) as ContatoWs[]) if (c.user_id && c.telefone && !telefonesWs.has(c.user_id)) telefonesWs.set(c.user_id, c.telefone)
  const devicesMap = new Map(((devices ?? []) as UserDevice[]).map((d) => [d.user_id, d]))
  const fontes: FontesAparelho = { devices: devicesMap, push: pushPorConta, telefonesWs }

  // Último aviso enviado pelo bot, por conta.
  const ultimoAviso = new Map<string, string>()
  for (const o of (avisos ?? []) as { user_id: string | null; enviado_em: string | null }[]) {
    if (!o.user_id || !o.enviado_em) continue
    const atual = ultimoAviso.get(o.user_id)
    if (!atual || o.enviado_em > atual) ultimoAviso.set(o.user_id, o.enviado_em)
  }

  // A tabela: uma linha por conta, com tudo que a planilha do WhatsApp sabe sobre ela.
  const tabela: LinhaAluno[] = a.pessoas.map((p): LinhaAluno => {
    const c = ws.contas[p.id]
    const al = wsPorConta.get(p.id)
    const escola = c?.escola ?? al?.escola ?? null
    const ano = c?.ano ?? al?.ano ?? null
    const canal = canalCurto(devicesMap.get(p.id))
    return {
      id: p.id, nome: p.nome, user: p.user,
      escola: escola && escola !== 'Não informada' ? escola : null,
      escolaCurta: escola && escola !== 'Não informada' ? escolaCurta(escola) : null,
      ano: ano && ano !== 'Não informado' ? ano : null,
      canal: canal?.key ?? null, canalLabel: canal?.label ?? null,
      ws: al ? al.status : 'fora',
      entrou: p.criado,
      primeiraMsg: al?.primeiraMsg ?? null,
      aviso: ultimoAviso.get(p.id) ?? null,
      ultAb: p.ultAb, diasAt: p.diasAt,
      grupo: p.grupo, grupoTag: GRUPO_META[p.grupo].tag, grupoCor: GRUPO_META[p.grupo].cor,
      pontos: p.pontos, onboarding: p.onboarding,
    }
  }).sort((x, y) => y.diasAt - x.diasAt || y.pontos - x.pontos)

  const sel = u ? a.pessoas.find((p) => p.id === u) ?? null : null
  const det = sel ? detalheAluno(sel, a, opensR, usageR, simsR, essR, tkR, ws, fontes) : null

  return (
    <div className={`grid h-full ${det ? 'grid-cols-[318px_minmax(0,1fr)_460px]' : 'grid-cols-[318px_minmax(0,1fr)]'}`}>
      <RelatoriosColuna r={base} total={a.total} days={days} hoje={hoje} ws={ws} />
      <div className="h-full min-h-0 border-r"><AlunosTabela linhas={tabela} selected={u} hoje={hoje} buscaInicial={q} /></div>
      {det && <div className="h-full min-h-0 overflow-hidden"><AlunoDetalheView d={det} hoje={hoje} /></div>}
    </div>
  )
}
