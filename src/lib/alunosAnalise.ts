import type { Analise, Pessoa, Dia } from './analytics'
import { DIAS, GRUPO_META, addDays, diffDays, dowPt, type Grupo } from './analytics'
import type { AppOpen, AiUsageRow } from './types'
import { featureLabel } from './types'
import type { Aluno, ResumoAlunos, ContaOrigem } from './alunos'
import { montarAparelho, type Aparelho, type UserDevice, type PushTokenLite } from './aparelho'

/**
 * Os três relatórios da mesa de alunos (desenho F): de onde vêm, frequência e
 * uso — primeiro pra base inteira, depois pra uma pessoa só. Tudo derivado da
 * `Analise` que a visão geral já monta, mais simulados, redações, tickets e a
 * planilha do WhatsApp. Sem chamada de IA: é conta, não opinião.
 */

export type Item = { label: string; value: number }
export type SimRow = {
  user_id: string; total_questions: number | null; correct_answers: number | null; status: string | null; started_at: string
  /** vindos da mesa de alunos (113); o resto do painel pode não pedir */
  points_earned?: number | null; type?: string | null; exam?: string | null; subject?: string | null
}
/** Uma linha do extrato de pontos do aluno: o que fez, quando, quanto valeu. */
export type Lancamento = { dia: string; oque: string; detalhe: string | null; pontos: number | null }
export type EssayRow = { user_id: string; created_at: string }
export type TicketLite = {
  id: number; ref: string; apelido: string | null; title: string | null; priority: string; status: string; user_id: string | null; created_at: string
  /** Contexto do aparelho anexado ao ticket — fallback do card "Aparelho" quando user_devices ainda não tem a pessoa. */
  platform?: string | null; os_version?: string | null; device_model?: string | null; app_version?: string | null
}

export type RelatoriosBase = {
  origem: { escolas: Item[]; tipoEscola: Item[]; canal: Item[]; exames: Item[]; cursos: Item[] }
  frequencia: {
    grupos: { g: Grupo; n: number }[]
    semana: { d: Dia; v: number }[]
    diasSemana: number          // média de dias/semana entre quem abriu
    sumiram: number
    rotina: { esp: number; cump: number; extra: number }
    recencia: Item[]
  }
  uso: {
    recursos: Item[]            // chamadas de IA por recurso + simulados + redações
    simulados: { n: number; acerto: number | null }
    redacoes: number
    ia: { chamadas: number; tokens: number; custo: number; pessoas: number; erros: number }
  }
}

export type AlunoDetalhe = {
  p: Pessoa
  ws: Aluno | null
  /** Escola/ano/canal da conta por qualquer ponte (contatos, manual, visita). */
  origem: ContaOrigem | null
  calendario: { dia: string; aberturas: number }[]   // últimos 14 dias, do mais antigo ao mais novo
  recursos: Item[]
  simulados: { n: number; acerto: number | null }
  redacoes: number
  /** Desde o cadastro, não só o período: é o que explica o total de pontos. */
  totais: { sessoes: number; redacoes: number; acerto: number | null }
  /** Extrato: lançamentos mais recentes primeiro (sessões, redações, cadastro). */
  extrato: Lancamento[]
  tickets: TicketLite[]
  diasSemana: number
  /** Telefone (cadastro do app, senão a ponte do WhatsApp), cru. */
  telefone: string | null
  /** Celular, sistema, versão do app e canal (beta/loja). null = nenhuma fonte sabe. */
  aparelho: Aparelho | null
}

export type FontesAparelho = {
  devices: Map<string, UserDevice>
  push: Map<string, PushTokenLite>
  /** Telefone por conta vindo das pontes do WhatsApp (contatos_whatsapp). */
  telefonesWs: Map<string, string>
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const conta = <T,>(xs: T[], key: (x: T) => string | null): Item[] => {
  const m = new Map<string, number>()
  for (const x of xs) { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
}
function acertoMedio(sims: SimRow[]): number | null {
  const ok = sims.filter((s) => s.total_questions && s.correct_answers !== null)
  if (!ok.length) return null
  return media(ok.map((s) => (s.correct_answers ?? 0) / (s.total_questions ?? 1)))
}
function recursosDe(usage: AiUsageRow[], sims: SimRow[], essays: EssayRow[]): Item[] {
  const ia = conta(usage, (u) => featureLabel(u.feature))
  const extras: Item[] = []
  if (sims.length) extras.push({ label: 'Simulados', value: sims.length })
  if (essays.length) extras.push({ label: 'Redações', value: essays.length })
  return [...ia, ...extras].sort((a, b) => b.value - a.value)
}

export function relatoriosBase(
  a: Analise, opens: AppOpen[], usage: AiUsageRow[], sims: SimRow[], essays: EssayRow[], ws: ResumoAlunos,
): RelatoriosBase {
  const ids = new Set(a.pessoas.map((p) => p.id))
  const noPeriodo = (iso: string) => iso.slice(0, 10) > a.since && iso.slice(0, 10) <= a.hoje
  const wsPorConta = new Map<string, Aluno>()
  for (const al of ws.alunos) if (al.conta) wsPorConta.set(al.conta.id, al)

  // origem
  const escolas = conta(a.pessoas, (p) => ws.contas[p.id]?.escola ?? wsPorConta.get(p.id)?.escola ?? 'Sem escola identificada')
  const tipoEscola = [
    { label: 'Pública', value: a.perfil.publica }, { label: 'Particular', value: a.perfil.particular },
    { label: 'Não informou', value: a.total - a.perfil.publica - a.perfil.particular },
  ].filter((x) => x.value > 0)
  const canalDe = (id: string) => ws.contas[id]?.canal ?? (wsPorConta.has(id) ? 'whatsapp' : null)
  const canal = [
    { label: 'WhatsApp', value: a.pessoas.filter((p) => canalDe(p.id) === 'whatsapp').length },
    { label: 'Contato direto', value: a.pessoas.filter((p) => canalDe(p.id) === 'direto').length },
    { label: 'Outro caminho', value: a.pessoas.filter((p) => !canalDe(p.id)).length },
  ].filter((x) => x.value > 0)

  // frequência
  const grupos = (Object.keys(GRUPO_META) as Grupo[]).map((g) => ({ g, n: a.grupos[g].length }))
  const semanaMap = new Map<Dia, number>(DIAS.map((d) => [d, 0]))
  for (const o of opens) if (ids.has(o.user_id) && noPeriodo(o.dia)) semanaMap.set(dowPt(o.dia), (semanaMap.get(dowPt(o.dia)) ?? 0) + o.aberturas)
  const semana = DIAS.map((d) => ({ d, v: semanaMap.get(d) ?? 0 }))
  const abriram = a.pessoas.filter((p) => p.diasAt > 0)
  const diasSemana = media(abriram.map((p) => p.diasAt / (a.days / 7)))
  const sumiram = a.pessoas.filter((p) => p.diasAt >= 2 && p.ultAb && diffDays(p.ultAb, a.hoje) >= 6).length

  // uso
  const usoPeriodo = usage.filter((u) => ids.has(u.user_id))
  const simsP = sims.filter((s) => ids.has(s.user_id) && noPeriodo(s.started_at))
  const essP = essays.filter((e) => ids.has(e.user_id) && noPeriodo(e.created_at))

  return {
    origem: { escolas, tipoEscola, canal, exames: a.perfil.exames, cursos: a.perfil.cursos },
    frequencia: { grupos, semana, diasSemana, sumiram, rotina: { esp: a.rotina.esp, cump: a.rotina.cump, extra: a.rotina.extra }, recencia: a.recencia },
    uso: {
      recursos: recursosDe(usoPeriodo, simsP, essP),
      simulados: { n: simsP.length, acerto: acertoMedio(simsP) },
      redacoes: essP.length,
      ia: { chamadas: a.kpis.somaIA, tokens: a.kpis.somaTok, custo: a.kpis.somaCusto, pessoas: a.kpis.usouIA, erros: a.kpis.falhasIA },
    },
  }
}

export function detalheAluno(
  p: Pessoa, a: Analise, opens: AppOpen[], usage: AiUsageRow[], sims: SimRow[], essays: EssayRow[], tickets: TicketLite[], ws: ResumoAlunos,
  fontes?: FontesAparelho,
): AlunoDetalhe {
  const meusTickets = tickets.filter((t) => t.user_id === p.id).sort((x, y) => y.created_at.localeCompare(x.created_at))
  const meus = opens.filter((o) => o.user_id === p.id)
  const porDia = new Map(meus.map((o) => [o.dia, o.aberturas]))
  const calendario: { dia: string; aberturas: number }[] = []
  for (let i = 13; i >= 0; i--) { const dia = addDays(a.hoje, -i); calendario.push({ dia, aberturas: porDia.get(dia) ?? 0 }) }
  const meuUso = usage.filter((u) => u.user_id === p.id)
  const todosSims = sims.filter((s) => s.user_id === p.id)
  const todasRed = essays.filter((e) => e.user_id === p.id)
  // O card "Uso" fala do PERÍODO (14 dias). O total desde o cadastro vai separado,
  // senão "2.900 pontos e 0 simulados" parece bug (13/10).
  const noPeriodo = (iso: string) => iso.slice(0, 10) > a.since && iso.slice(0, 10) <= a.hoje
  const meusSims = todosSims.filter((s) => noPeriodo(s.started_at))
  const minhasRed = todasRed.filter((e) => noPeriodo(e.created_at))
  const extrato: Lancamento[] = [
    ...todosSims.map((s) => ({
      dia: s.started_at.slice(0, 10),
      oque: s.type === 'full' ? 'Simulado completo' : s.exam === 'feed' ? 'Quiz do dia' : 'Prática',
      detalhe: [s.exam && s.exam !== 'feed' ? s.exam.toUpperCase() : null, s.subject ?? null, s.total_questions ? `${s.correct_answers ?? 0}/${s.total_questions} certas` : null].filter(Boolean).join(' · ') || null,
      pontos: s.points_earned ?? null,
    })),
    ...todasRed.map((e) => ({ dia: e.created_at.slice(0, 10), oque: 'Redação enviada', detalhe: '600 + bônus do dia', pontos: null })),
    ...(p.onboarding ? [{ dia: p.criado.slice(0, 10), oque: 'Cadastro concluído', detalhe: 'bônus de 1º dia', pontos: 100 }] : []),
  ].sort((x, y) => y.dia.localeCompare(x.dia))
  return {
    p,
    ws: ws.alunos.find((al) => al.conta?.id === p.id) ?? null,
    origem: ws.contas[p.id] ?? null,
    calendario,
    recursos: recursosDe(meuUso, meusSims, minhasRed),
    simulados: { n: meusSims.length, acerto: acertoMedio(meusSims) },
    redacoes: minhasRed.length,
    totais: { sessoes: todosSims.length, redacoes: todasRed.length, acerto: acertoMedio(todosSims) },
    extrato: extrato.slice(0, 12),
    tickets: meusTickets.slice(0, 5),
    diasSemana: p.diasAt / (a.days / 7),
    telefone: p.telefone ?? fontes?.telefonesWs.get(p.id) ?? null,
    aparelho: montarAparelho(fontes?.devices.get(p.id), fontes?.push.get(p.id), meusTickets),
  }
}
