import { supabaseServer } from '@/lib/supabase/server'
import type { AppUser, AppOpen, AiUsageRow } from '@/lib/types'
import { analisar, addDays, hojeSP, GRUPO_META } from '@/lib/analytics'
import { alunosDeLinhas, resumirAlunos, semAcento, escolaCurta, escolaSlug, CANAL_LABEL, type LinhaScan, type ContatoWs, type OrigemManual } from '@/lib/alunos'
import { carregarAlunos } from '@/lib/alunosCsv'
import { RankingResumo, RankingLista, type Linha, type Filtros } from '@/components/RankingWorkbench'
import type { PerfilResumo } from '@/components/PerfilPopup'

export const dynamic = 'force-dynamic'

const ANO_APP: Record<string, string> = { em1: '1º ano', em2: '2º ano', em3: '3º ano', cursinho: 'Cursinho', formado: 'Formado', fundamental: 'Fundamental' }

/**
 * Ranking de pontos (`users.total_points`) com filtros por escola, ano, canal
 * de chegada, grupo de frequência e busca. Só existe o total acumulado — o
 * app não guarda histórico de pontos por dia — então não há ranking "da
 * semana"; o que dá pra recortar é quem entra na lista.
 */
export default async function RankingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const filtros: Filtros = { q: sp.q ?? '', escola: sp.escola ?? '', ano: sp.ano ?? '', canal: sp.canal ?? '', grupo: sp.grupo ?? '', ativos: sp.ativos === '1' }
  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const hoje = hojeSP()
  const days = 14
  const since = addDays(hoje, -days)

  const [{ data: users, error: uErr }, { data: opens }, { data: usage }, { data: scanLinhas }, { data: contatos }, { data: origens }, { data: sims }, { data: essays }] = await Promise.all([
    pub.from('users').select('id, full_name, username, email, premium_status, total_points, current_streak, longest_streak, last_activity_date, onboarding_completed, target_exam, target_course, age, school_type, school_year, weekly_availability, created_at, phone').limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    pub.from('ai_usage').select('user_id, feature, total_tokens, ok, cost_usd, created_at').gte('created_at', `${since}T00:00:00Z`).limit(50000),
    supabase.from('alunos_whatsapp').select('telefone, contato, nome, telefone_informado, escola_bruta, ano_bruto, status, observacao, cadastrado_no_bot, registrado_no_app, ultima_msg, atualizado_em').limit(10000),
    supabase.from('contatos_whatsapp').select('user_id, telefone, escola, ano, como').limit(5000),
    supabase.from('alunos_origem').select('user_id, canal, escola, ano, cidade, estado, curso, observacao').limit(5000),
    // DUKA 8: o que a pessoa fez de verdade no período (simulados/provas e redações)
    pub.from('simulations').select('user_id, started_at').gte('started_at', `${since}T00:00:00Z`).limit(20000),
    pub.from('essays').select('user_id, created_at').gte('created_at', `${since}T00:00:00Z`).limit(20000),
  ])
  if (uErr) return <div className="p-6 text-sm text-muted">Não consegui ler <code>public.users</code>: {uErr.message}</div>

  const hideList = (process.env.HIDE_USER_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const a = analisar((users ?? []) as unknown as AppUser[], (opens ?? []) as unknown as AppOpen[], (usage ?? []) as unknown as AiUsageRow[], { days, hoje, hideEmails: hideList })
  const linhas = (scanLinhas ?? []) as LinhaScan[]
  type URow = { id: string; phone?: string | null; current_streak?: number | null; longest_streak?: number | null; school_year?: string | null }
  const urows = (users ?? []) as URow[]
  const telefones = new Map(urows.map((u) => [u.id, u.phone ?? null]))
  const extra = new Map(urows.map((u) => [u.id, u]))
  const ws = resumirAlunos(
    linhas.length ? { ...alunosDeLinhas(linhas), arquivo: 'support.alunos_whatsapp' } : carregarAlunos(),
    a.pessoas,
    { contatos: (contatos ?? []) as ContatoWs[], telefones, origens: (origens ?? []) as OrigemManual[] },
  )
  const wsPorConta = new Map(ws.alunos.filter((al) => al.conta).map((al) => [al.conta!.id, al]))
  const sims14 = new Map<string, number>(); for (const s of (sims ?? []) as { user_id: string }[]) sims14.set(s.user_id, (sims14.get(s.user_id) ?? 0) + 1)
  const red14 = new Map<string, number>(); for (const e of (essays ?? []) as { user_id: string }[]) red14.set(e.user_id, (red14.get(e.user_id) ?? 0) + 1)

  // uma linha por conta, já com tudo que os filtros e a tabela precisam
  const todas: Linha[] = a.pessoas.map((p) => {
    const c = ws.contas[p.id]
    const u = extra.get(p.id)
    const anoApp = u?.school_year ? ANO_APP[u.school_year] ?? u.school_year : null
    const ano = c?.ano && c.ano !== 'Não informado' ? c.ano : anoApp ?? 'Não informado'
    const escola = c?.escola ?? 'Sem escola identificada'
    const canal = c ? c.canal : wsPorConta.has(p.id) ? 'whatsapp' : 'outro'
    return {
      id: p.id, nome: p.nome, user: p.user, pontos: p.pontos, ofensiva: u?.current_streak ?? 0, maiorOfensiva: u?.longest_streak ?? 0,
      diasAt: p.diasAt, ultAb: p.ultAb, grupo: p.grupo,
      sims14: sims14.get(p.id) ?? 0, red14: red14.get(p.id) ?? 0, planoCump: p.cump, planoEsp: p.esp,
      estudou: (sims14.get(p.id) ?? 0) > 0 || (red14.get(p.id) ?? 0) > 0 || p.cump > 0,
      escola, escolaCurta: escolaCurta(escola), escolaSlug: escolaSlug(escola), ano, canal, canalLabel: CANAL_LABEL[canal as keyof typeof CANAL_LABEL] ?? 'Outro caminho',
    }
  }).sort((x, y) => y.pontos - x.pontos || y.diasAt - x.diasAt)
  todas.forEach((l, i) => { l.posicao = i + 1 })

  const nq = semAcento(filtros.q)
  const lista = todas.filter((l) =>
    (!filtros.escola || l.escolaSlug === filtros.escola) &&
    (!filtros.ano || l.ano === filtros.ano) &&
    (!filtros.canal || l.canal === filtros.canal) &&
    (!filtros.grupo || l.grupo === filtros.grupo) &&
    (!filtros.ativos || l.estudou) &&
    (!nq || semAcento(`${l.nome} ${l.user ?? ''} ${l.escola}`).includes(nq)),
  )

  // perfis pro pop-up
  const perfis: Record<string, PerfilResumo> = {}
  for (const p of a.pessoas) {
    const c = ws.contas[p.id]; const al = wsPorConta.get(p.id)
    perfis[p.id] = {
      id: p.id, nome: p.nome, user: p.user, email: p.email, criado: p.criado, ultAb: p.ultAb, diasAt: p.diasAt, ab: p.ab,
      pontos: p.pontos, grupoTag: GRUPO_META[p.grupo].tag, grupoCor: GRUPO_META[p.grupo].cor,
      exame: p.exame, curso: p.curso, idade: p.idade, tipoEscola: p.escola === 'publica' ? 'pública' : p.escola === 'particular' ? 'particular' : null, ia: p.ia,
      escola: c?.escola ?? al?.escola ?? null, ano: c?.ano ?? al?.ano ?? null, canal: c ? CANAL_LABEL[c.canal] : al ? 'WhatsApp' : null, cidade: c?.cidade ?? null,
      contato: al?.contato ?? null, obs: al?.obs || null,
    }
  }

  const opcoes = {
    escolas: [...new Map(todas.map((l) => [l.escolaSlug, { slug: l.escolaSlug, curto: l.escolaCurta, escola: l.escola }])).values()],
    anos: [...new Set(todas.map((l) => l.ano))].sort(),
    canais: [...new Map(todas.map((l) => [l.canal, l.canalLabel])).entries()].map(([k, label]) => ({ k, label })),
  }

  return (
    <div className="grid h-full grid-cols-[320px_minmax(0,1fr)]">
      <RankingResumo lista={lista} total={todas.length} filtros={filtros} />
      <div className="h-full min-h-0"><RankingLista lista={lista} filtros={filtros} opcoes={opcoes} perfis={perfis} hoje={hoje} /></div>
    </div>
  )
}
