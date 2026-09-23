import { supabaseServer } from '@/lib/supabase/server'
import type { AppUser, AppOpen, AiUsageRow } from '@/lib/types'
import { analisar, addDays, hojeSP, diffDays } from '@/lib/analytics'
import { carregarAlunos, alunosDeLinhas, resumirAlunos, semAcento, type LinhaScan, type ScanRun, type ContatoWs } from '@/lib/alunos'
import { relatoriosBase, detalheAluno, type SimRow, type EssayRow, type TicketLite } from '@/lib/alunosAnalise'
import { RelatoriosColuna, AlunosLista, AlunoDetalheView } from '@/components/AlunosWorkbench'

export const dynamic = 'force-dynamic'

/**
 * Mesa de alunos (desenho F): três colunas fixas.
 *   1. os três relatórios da base inteira (de onde vêm, frequência, uso)
 *   2. lista de alunos com busca (`?q=`) e filtros (`?f=`)
 *   3. os mesmos três relatórios só do aluno selecionado (`?u=id`)
 */
export default async function AlunosPage({ searchParams }: { searchParams: Promise<{ u?: string; f?: string; q?: string }> }) {
  const { u = null, f = 'todos', q = '' } = await searchParams
  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const hoje = hojeSP()
  const days = 14
  const since = addDays(hoje, -days)

  const [{ data: users, error: uErr }, { data: opens }, { data: usage }, { data: sims }, { data: essays }, { data: tickets }, { data: scanLinhas }, { data: scanRuns }, { data: contatos }] = await Promise.all([
    pub.from('users').select('id, full_name, username, email, premium_status, total_points, current_streak, last_activity_date, onboarding_completed, target_exam, target_course, age, school_type, weekly_availability, created_at, phone').limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    pub.from('ai_usage').select('user_id, feature, total_tokens, ok, cost_usd, created_at').gte('created_at', `${since}T00:00:00Z`).limit(50000),
    pub.from('simulations').select('user_id, total_questions, correct_answers, status, started_at').limit(20000),
    pub.from('essays').select('user_id, created_at').limit(20000),
    supabase.from('tickets').select('id, ref, title, priority, status, user_id, created_at').limit(5000),
    // planilha do WhatsApp (migration 089): o que o scan gravou
    supabase.from('alunos_whatsapp').select('telefone, contato, nome, telefone_informado, escola_bruta, ano_bruto, status, observacao, cadastrado_no_bot, registrado_no_app, ultima_msg, atualizado_em').limit(10000),
    supabase.from('alunos_scan_runs').select('id, origem, status, solicitado_em, iniciado_em, concluido_em, total, erro').order('id', { ascending: false }).limit(5),
    supabase.from('contatos_whatsapp').select('user_id, telefone, escola, ano, como').limit(5000),
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
    { contatos: (contatos ?? []) as ContatoWs[], telefones },
  )
  const runs = (scanRuns ?? []) as ScanRun[]
  const scan = { ultimo: runs[0] ?? null, aberto: runs.find((r) => r.status === 'solicitado' || r.status === 'rodando') ?? null }
  const simsR = (sims ?? []) as SimRow[]
  const essR = (essays ?? []) as EssayRow[]
  const tkR = (tickets ?? []) as TicketLite[]
  const opensR = (opens ?? []) as AppOpen[]
  const usageR = (usage ?? []) as AiUsageRow[]

  const base = relatoriosBase(a, opensR, usageR, simsR, essR, ws)
  const wsPorConta = new Map(ws.alunos.filter((al) => al.conta).map((al) => [al.conta!.id, al]))
  const escolaDe = (id: string) => ws.contas[id]?.escola ?? wsPorConta.get(id)?.escola ?? null

  // filtro + busca
  const nq = semAcento(q)
  let lista = a.pessoas.filter((p) => {
    if (f === 'sumiram') return p.diasAt >= 2 && p.ultAb && diffDays(p.ultAb, hoje) >= 6
    if (f === 'habito') return p.grupo === 'habito'
    if (f === 'nunca') return p.grupo === 'nunca'
    if (f.startsWith('escola:')) {
      const e = ws.porEscola.find((x) => x.slug === f.slice(7))
      return !!e && escolaDe(p.id) === e.escola
    }
    return true
  })
  if (nq) lista = lista.filter((p) => semAcento(`${p.nome} ${p.user ?? ''} ${p.email ?? ''} ${escolaDe(p.id) ?? ''}`).includes(nq))
  lista.sort((x, y) => y.diasAt - x.diasAt || y.pontos - x.pontos)

  const sel = u ? a.pessoas.find((p) => p.id === u) ?? null : null
  const det = sel ? detalheAluno(sel, a, opensR, usageR, simsR, essR, tkR, ws) : null

  return (
    <div className="grid h-full grid-cols-[318px_360px_minmax(0,1fr)]">
      <RelatoriosColuna r={base} total={a.total} days={days} hoje={hoje} ws={ws} scan={scan} />
      <div className="h-full min-h-0 border-r"><AlunosLista pessoas={lista} selected={u} f={f} q={q} hoje={hoje} escolaDe={escolaDe} escolas={ws.porEscola} /></div>
      <div className="h-full min-h-0 overflow-hidden">
        {det ? <AlunoDetalheView d={det} hoje={hoje} /> : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-muted">
            <div className="text-4xl">☺</div>
            <div className="font-display font-bold text-fg">Escolha um aluno na lista</div>
            <div className="max-w-[36ch] text-xs">Aqui aparecem os mesmos três relatórios, só dele: de onde veio, com que frequência abre o app e o que usa.</div>
          </div>
        )}
      </div>
    </div>
  )
}
