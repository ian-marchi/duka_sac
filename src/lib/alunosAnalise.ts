import type { Analise, Pessoa, Dia } from './analytics'
import { DIAS, GRUPO_META, addDays, diffDays, dowPt, type Grupo } from './analytics'
import type { AppOpen, AiUsageRow } from './types'
import { featureLabel } from './types'
import type { Aluno, ResumoAlunos } from './alunos'

/**
 * Os três relatórios da mesa de alunos (desenho F): de onde vêm, frequência e
 * uso — primeiro pra base inteira, depois pra uma pessoa só. Tudo derivado da
 * `Analise` que a visão geral já monta, mais simulados, redações, tickets e a
 * planilha do WhatsApp. Sem chamada de IA: é conta, não opinião.
 */

export type Item = { label: string; value: number }
export type SimRow = { user_id: string; total_questions: number | null; correct_answers: number | null; status: string | null; started_at: string }
export type EssayRow = { user_id: string; created_at: string }
export type TicketLite = { id: number; ref: string; title: string | null; priority: string; status: string; user_id: string | null; created_at: string }

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
  calendario: { dia: string; aberturas: number }[]   // últimos 14 dias, do mais antigo ao mais novo
  recursos: Item[]
  simulados: { n: number; acerto: number | null }
  redacoes: number
  tickets: TicketLite[]
  diasSemana: number
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
  const escolas = conta(a.pessoas, (p) => wsPorConta.get(p.id)?.escola ?? 'Sem planilha')
  const tipoEscola = [
    { label: 'Pública', value: a.perfil.publica }, { label: 'Particular', value: a.perfil.particular },
    { label: 'Não informou', value: a.total - a.perfil.publica - a.perfil.particular },
  ].filter((x) => x.value > 0)
  const canal = [
    { label: 'WhatsApp beta (planilha)', value: a.pessoas.filter((p) => wsPorConta.has(p.id)).length },
    { label: 'Outro caminho', value: a.pessoas.filter((p) => !wsPorConta.has(p.id)).length },
  ]

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
): AlunoDetalhe {
  const meus = opens.filter((o) => o.user_id === p.id)
  const porDia = new Map(meus.map((o) => [o.dia, o.aberturas]))
  const calendario: { dia: string; aberturas: number }[] = []
  for (let i = 13; i >= 0; i--) { const dia = addDays(a.hoje, -i); calendario.push({ dia, aberturas: porDia.get(dia) ?? 0 }) }
  const meuUso = usage.filter((u) => u.user_id === p.id)
  const meusSims = sims.filter((s) => s.user_id === p.id)
  const minhasRed = essays.filter((e) => e.user_id === p.id)
  return {
    p,
    ws: ws.alunos.find((al) => al.conta?.id === p.id) ?? null,
    calendario,
    recursos: recursosDe(meuUso, meusSims, minhasRed),
    simulados: { n: meusSims.length, acerto: acertoMedio(meusSims) },
    redacoes: minhasRed.length,
    tickets: tickets.filter((t) => t.user_id === p.id).sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 5),
    diasSemana: p.diasAt / (a.days / 7),
  }
}
