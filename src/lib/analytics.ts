// Dashboard geral — cruza users × app_opens × ai_usage.
// Porta fiel das regras do dashboard_usuarios.html:
//   nunca = 0 dias ativos · 1 sessão = 1 · voltou = 2–4 · hábito = 5+
//   rotina cumprida = dia planejado no onboarding em que a pessoa abriu o app
// Sem dependências: tudo em JS puro em cima das linhas cruas.

import type { AppUser, AppOpen, AiUsageRow } from './types'

export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const
export type Dia = (typeof DIAS)[number]
export const DIA_NOME: Record<Dia, string> = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo',
}

export type Grupo = 'habito' | 'testou' | 'sessao' | 'nunca'
export const GRUPO_META: Record<Grupo, { titulo: string; sub: string; desc: string; cor: string; tag: string }> = {
  habito: { titulo: 'Criaram hábito', sub: '5 ou mais dias com o app aberto', tag: 'Hábito',
            desc: 'Cinco ou mais dias distintos com o app aberto. Concentram a maior parte das aberturas e quase todo o uso de IA.',
            cor: 'rgb(14 148 105)' },
  testou: { titulo: 'Voltaram algumas vezes', sub: '2 a 4 dias de uso', tag: 'Voltou',
            desc: 'Entre dois e quatro dias de uso. Passaram da primeira sessão, mas ainda não viraram rotina.',
            cor: 'rgb(29 111 196)' },
  sessao: { titulo: 'Abriram uma vez só', sub: '1 único dia', tag: '1 sessão',
            desc: 'Um único dia de uso e nunca mais voltaram. É onde está a maior perda em número de pessoas.',
            cor: 'rgb(201 130 26)' },
  nunca:  { titulo: 'Nunca abriram o app', sub: 'sem registro em app_opens', tag: 'Nunca abriu',
            desc: 'Existe cadastro na base, mas nenhuma abertura registrada. Contas que nunca viram o produto.',
            cor: 'rgb(200 30 99)' },
}

export type Pessoa = {
  id: string
  nome: string
  user: string | null
  email: string | null
  /** Telefone do cadastro, cru ("+5538992667095"); null se a pessoa não informou. */
  telefone: string | null
  criado: string
  ultAtiv: string | null
  pontos: number
  onboarding: boolean
  idade: number | null
  exame: string | null
  curso: string | null
  escola: string | null
  premium: boolean
  teste: boolean
  ab: number          // aberturas no período
  diasAt: number      // dias distintos no período
  ultAb: string | null // última abertura (qualquer época)
  ia: number
  tok: number
  custo: number
  planDias: Dia[]
  planHoras: number
  esp: number         // dias planejados que caíram no período
  cump: number        // desses, quantos abriu
  extra: number       // dias abertos fora do planejado
  diasCump: Dia[]
  grupo: Grupo
}

export type Analise = {
  hoje: string
  since: string
  days: number
  pessoas: Pessoa[]
  total: number
  kpis: {
    contas: number; abriram: number; at7: number; at2: number; habito: number; voltou: number
    somaAb: number; somaIA: number; somaTok: number; somaCusto: number; usouIA: number; falhasIA: number
  }
  funil: { n: string; e: string; v: number; cor: string }[]
  grupos: Record<Grupo, Pessoa[]>
  recencia: { label: string; value: number; cor: string }[]
  rotina: {
    com: number; sem: Pessoa[]; medDias: number; medHoras: number; esp: number; cump: number
    zero: Pessoa[]; extra: number
    semana: { d: Dia; esp: number; cump: number }[]
  }
  perfil: {
    exames: { label: string; value: number }[]
    cursos: { label: string; value: number }[]
    idades: { label: string; value: number }[]
    particular: number; publica: number; medianaIdade: number | null
  }
  achados: { flag: string; titulo: string; texto: string; cor: string }[]
}

// ── datas (tudo em YYYY-MM-DD, aritmética em UTC pra não escorregar de fuso) ─
const ms = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()
export const diffDays = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86_400_000)
export const addDays = (iso: string, n: number) =>
  new Date(ms(iso) + n * 86_400_000).toISOString().slice(0, 10)
export const hojeSP = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
/** 'seg'…'dom' de uma data ISO. JS: 0=dom … 6=sáb. */
export const dowPt = (iso: string): Dia => DIAS[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]

export function grupoDe(diasAt: number): Grupo {
  if (diasAt === 0) return 'nunca'
  if (diasAt >= 5) return 'habito'
  if (diasAt >= 2) return 'testou'
  return 'sessao'
}

export function analisar(
  users: AppUser[], opens: AppOpen[], usage: AiUsageRow[],
  opts: { days: number; hoje?: string; hideEmails?: string[] },
): Analise {
  const hoje = opts.hoje ?? hojeSP()
  const since = addDays(hoje, -opts.days)
  const hide = new Set((opts.hideEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))

  // dias planejáveis dentro do período (since, hoje]
  const diasPeriodo: string[] = []
  for (let d = addDays(since, 1); d <= hoje; d = addDays(d, 1)) diasPeriodo.push(d)

  const opensBy = new Map<string, AppOpen[]>()
  for (const o of opens) (opensBy.get(o.user_id) ?? opensBy.set(o.user_id, []).get(o.user_id)!).push(o)
  const usageBy = new Map<string, AiUsageRow[]>()
  for (const u of usage) (usageBy.get(u.user_id) ?? usageBy.set(u.user_id, []).get(u.user_id)!).push(u)

  const pessoas: Pessoa[] = users.map((u) => {
    const ops = opensBy.get(u.id) ?? []
    const noPeriodo = ops.filter((o) => o.dia > since && o.dia <= hoje)
    const diasSet = new Set(noPeriodo.map((o) => o.dia))
    const ultAb = ops.length ? ops.reduce((m, o) => (o.dia > m ? o.dia : m), ops[0].dia) : null
    const us = (usageBy.get(u.id) ?? []).filter((x) => x.created_at.slice(0, 10) > since)
    const av = u.weekly_availability ?? {}
    const planDias = DIAS.filter((d) => Array.isArray(av[d]) && av[d].length > 0)
    const planSet = new Set<string>(planDias)
    const planHoras = planDias.reduce((s, d) => s + (av[d]?.length ?? 0), 0)
    const esp = diasPeriodo.filter((d) => planSet.has(dowPt(d))).length
    const diasCumpSet = new Set<Dia>()
    let cump = 0, extra = 0
    for (const d of diasSet) {
      const dow = dowPt(d)
      if (planSet.has(dow)) { cump++; diasCumpSet.add(dow) } else extra++
    }
    const teste = !!u.email && hide.has(u.email.toLowerCase())
    return {
      id: u.id,
      nome: u.full_name?.trim() || u.username || u.email?.split('@')[0] || 'sem nome',
      user: u.username, email: u.email,
      telefone: u.phone?.trim() || null,
      criado: u.created_at.slice(0, 10),
      ultAtiv: u.last_activity_date,
      pontos: u.total_points ?? 0,
      onboarding: !!u.onboarding_completed,
      idade: u.age, exame: u.target_exam, curso: u.target_course, escola: u.school_type,
      premium: u.premium_status === 'premium' || u.premium_status === 'trial',
      teste,
      ab: noPeriodo.reduce((s, o) => s + o.aberturas, 0),
      diasAt: diasSet.size,
      ultAb,
      ia: us.length,
      tok: us.reduce((s, x) => s + (x.total_tokens ?? 0), 0),
      custo: us.reduce((s, x) => s + (x.cost_usd ?? 0), 0),
      planDias, planHoras, esp, cump, extra,
      diasCump: DIAS.filter((d) => diasCumpSet.has(d)),
      grupo: grupoDe(diasSet.size),
    }
  }).filter((p) => !p.teste)

  const total = pessoas.length
  const abriram = pessoas.filter((p) => p.diasAt > 0)
  const voltou = pessoas.filter((p) => p.diasAt >= 2)
  const habito = pessoas.filter((p) => p.diasAt >= 5)
  const at7 = pessoas.filter((p) => p.ultAb && diffDays(p.ultAb, hoje) <= 7)
  const at2 = pessoas.filter((p) => p.ultAb && diffDays(p.ultAb, hoje) <= 2)
  const usouIA = pessoas.filter((p) => p.ia > 0)
  const somaAb = pessoas.reduce((s, p) => s + p.ab, 0)
  const somaIA = pessoas.reduce((s, p) => s + p.ia, 0)
  const somaTok = pessoas.reduce((s, p) => s + p.tok, 0)
  const somaCusto = pessoas.reduce((s, p) => s + p.custo, 0)
  const falhasIA = usage.filter((x) => !x.ok && x.created_at.slice(0, 10) > since).length

  const grupos: Record<Grupo, Pessoa[]> = { habito: [], testou: [], sessao: [], nunca: [] }
  for (const p of pessoas) grupos[p.grupo].push(p)
  for (const g of Object.keys(grupos) as Grupo[]) grupos[g].sort((a, b) => b.ab - a.ab || b.ia - a.ia)

  const rec = (f: (d: number | null) => boolean) =>
    pessoas.filter((p) => f(p.ultAb ? diffDays(p.ultAb, hoje) : null)).length
  const recencia = [
    { label: 'Hoje ou ontem',   value: rec((d) => d !== null && d <= 1),          cor: 'rgb(14 148 105)' },
    { label: '2 a 7 dias',      value: rec((d) => d !== null && d > 1 && d <= 7),  cor: 'rgb(95 184 148)' },
    { label: '8 a 14 dias',     value: rec((d) => d !== null && d > 7 && d <= 14), cor: 'rgb(201 130 26)' },
    { label: 'Mais de 14 dias', value: rec((d) => d !== null && d > 14),           cor: 'rgb(200 30 99)' },
    { label: 'Nunca abriu',     value: rec((d) => d === null),                     cor: 'rgb(176 186 201)' },
  ]

  // rotina
  const com = pessoas.filter((p) => p.planDias.length > 0)
  const sem = pessoas.filter((p) => p.planDias.length === 0)
  const espT = com.reduce((s, p) => s + p.esp, 0)
  const cumpT = com.reduce((s, p) => s + p.cump, 0)
  const semana = DIAS.map((d) => ({
    d,
    esp: com.filter((p) => p.planDias.includes(d)).length * diasPeriodo.filter((x) => dowPt(x) === d).length,
    cump: com.filter((p) => p.diasCump.includes(d)).length,
  }))

  // perfil
  const conta = (pick: (p: Pessoa) => string | null) => {
    const m = new Map<string, number>()
    for (const p of pessoas) { const v = pick(p); if (v) m.set(v, (m.get(v) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const idadesOrd = pessoas.map((p) => p.idade).filter((x): x is number => x !== null).sort((a, b) => a - b)
  const perfil = {
    exames: conta((p) => p.exame?.toUpperCase() ?? null),
    cursos: conta((p) => p.curso ? cap(p.curso.split(',')[0].trim().toLowerCase()) : null).slice(0, 5),
    idades: [
      { label: '15 a 16 anos', value: pessoas.filter((p) => p.idade !== null && p.idade <= 16).length },
      { label: '17 a 18 anos', value: pessoas.filter((p) => p.idade === 17 || p.idade === 18).length },
      { label: '19 anos ou mais', value: pessoas.filter((p) => p.idade !== null && p.idade >= 19).length },
    ],
    particular: pessoas.filter((p) => p.escola === 'particular').length,
    publica: pessoas.filter((p) => p.escola === 'publica').length,
    medianaIdade: idadesOrd.length ? idadesOrd[Math.floor(idadesOrd.length / 2)] : null,
  }

  // achados (regras, não IA — a IA fica nos relatórios)
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%')
  const desalinhados = pessoas.filter((p) => p.ultAb && (!p.ultAtiv || p.ultAb > p.ultAtiv))
  const travados = pessoas.filter((p) => !p.onboarding && p.diasAt > 0)
  const ordIA = [...pessoas].sort((a, b) => b.ia - a.ia)
  const topIA = ordIA.slice(0, 3).filter((p) => p.ia > 0)
  const shareIA = topIA.reduce((s, p) => s + p.ia, 0)
  const umaVez = pessoas.filter((p) => p.diasAt === 1)
  const achados = [
    {
      cor: 'rgb(200 30 99)', flag: 'Dado que engana', titulo: 'O campo de última atividade está atrasado',
      texto: `${desalinhados.length} pessoas abriram o app depois da data gravada em last_activity_date` +
        (travados.length ? `, e ${travados.map((p) => p.nome).join(' e ')} abriu o app ${travados.reduce((s, p) => s + p.diasAt, 0)} dias diferentes sem constar nenhuma atividade` : '') +
        '. Para medir retenção, use app_opens — o campo do cadastro subestima o uso.',
    },
    {
      cor: 'rgb(201 130 26)', flag: 'Onde a jornada trava', titulo: `${umaVez.length} pessoas abriram uma vez e não voltaram`,
      texto: `Somadas às ${grupos.nunca.length} que nunca abriram, esse grupo é ${pct(umaVez.length + grupos.nunca.length, total)} da base. ` +
        `Mas quem passa do segundo dia tende a seguir: das ${voltou.length} que voltaram, ${habito.length} chegaram a cinco dias ou mais.`,
    },
    {
      cor: 'rgb(91 52 199)', flag: 'Concentração',
      titulo: topIA.length ? `${topIA.length === 1 ? 'Uma pessoa faz' : `${topIA.length} pessoas fazem`} a maior parte das chamadas de IA` : 'Ainda sem uso de IA no período',
      texto: topIA.length
        ? `${topIA.map((p) => p.nome).join(', ')} respondem por ${pct(shareIA, somaIA)} das chamadas (US$ ${somaCusto.toFixed(2)} no período). O custo de inferência hoje depende de um punhado de usuários — e o teto de consumo por pessoa ainda não foi testado.`
        : 'Nenhuma chamada de IA registrada no período.',
    },
  ]

  return {
    hoje, since, days: opts.days, pessoas, total,
    kpis: { contas: total, abriram: abriram.length, at7: at7.length, at2: at2.length, habito: habito.length,
            voltou: voltou.length, somaAb, somaIA, somaTok, somaCusto, usouIA: usouIA.length, falhasIA },
    funil: [
      { n: 'Criou a conta',              e: 'registro em users',        v: total,          cor: 'rgb(142 155 177)' },
      { n: 'Abriu o app ao menos 1 vez', e: 'aparece em app_opens',     v: abriram.length, cor: 'rgb(29 111 196)' },
      { n: 'Voltou em um segundo dia',   e: '2 ou mais dias distintos', v: voltou.length,  cor: 'rgb(91 52 199)' },
      { n: 'Usou algum recurso de IA',   e: 'aparece em ai_usage',      v: usouIA.length,  cor: 'rgb(201 130 26)' },
      { n: 'Criou hábito',               e: '5 ou mais dias ativos',    v: habito.length,  cor: 'rgb(14 148 105)' },
    ],
    grupos, recencia,
    rotina: {
      com: com.length, sem,
      medDias: com.length ? com.reduce((s, p) => s + p.planDias.length, 0) / com.length : 0,
      medHoras: com.length ? com.reduce((s, p) => s + p.planHoras, 0) / com.length : 0,
      esp: espT, cump: cumpT,
      zero: com.filter((p) => p.esp > 0 && p.cump === 0),
      extra: pessoas.reduce((s, p) => s + p.extra, 0),
      semana,
    },
    perfil, achados,
  }
}
