import fs from 'node:fs'
import path from 'node:path'
import type { Pessoa } from './analytics'

/**
 * Lista de alunos abordados no WhatsApp pro teste beta (planilha manual).
 *
 * FONTE: `data/alunos_duka.csv`, na raiz do painel. É um arquivo que o Ian
 * mantém à mão — pra atualizar, basta trocar o CSV e recarregar a página; nada
 * fica no banco. Colunas esperadas (cabeçalho da primeira linha):
 *
 *   Contato WhatsApp, Nome, Telefone informado, Escola, Ano, Status, Observação
 *
 * O parser aceita aspas, vírgula dentro de aspas e BOM. Linhas sem Nome são
 * contatos que não responderam ou sem dados — continuam contando.
 *
 * Também cruza os nomes da planilha com as contas do app (`Pessoa` da análise):
 * é a única ponte, porque `users` não guarda telefone. Comparação por nome
 * completo normalizado (sem acento, minúsculo). Nome igual não prova que é a
 * mesma pessoa, mas erra pouco em escola do interior.
 */

export type StatusAluno = 'respondeu' | 'nao_respondeu' | 'sem_dados'
export type AnoAluno = '1º ano' | '2º ano' | '3º ano' | 'Professor(a)' | 'Não informado'

export type Aluno = {
  contato: string
  nome: string
  telefone: string
  escolaBruta: string
  escola: string
  anoBruto: string
  ano: AnoAluno
  professor: boolean
  status: StatusAluno
  obs: string
  /** Conta do app com o mesmo nome, se achou. */
  conta: { id: string; nome: string; grupo: Pessoa['grupo']; criado: string } | null
}

export type ResumoAlunos = {
  arquivo: string
  atualizadoEm: string | null
  alunos: Aluno[]
  total: number
  responderam: number
  naoResponderam: number
  semDados: number
  professores: number
  comConta: number
  escolas: { label: string; value: number }[]
  /** Uma linha por escola: total de alunos do WhatsApp, quantos responderam, quantos já têm conta. */
  porEscola: { escola: string; curto: string; slug: string; total: number; responderam: number; comConta: number; professores: number }[]
  anos: { label: string; value: number }[]
  avisos: { tipo: string; itens: { nome: string; contato: string; obs: string }[] }[]
  duplicatas: Aluno[]
  /** Escola/ano/canal de cada conta do app que conseguimos ligar a alguma origem (por qualquer ponte). */
  contas: Record<string, ContaOrigem>
}

export type ContaOrigem = {
  escola: string
  ano: string
  como: string
  /** por onde a pessoa chegou: 'whatsapp' (planilha do bot) ou 'direto' (convite pessoal) */
  canal: 'whatsapp' | 'direto' | 'indicacao' | 'outro'
  cidade?: string | null
  curso?: string | null
}

/** Linha de support.alunos_origem (090): contas que NÃO vieram pelo WhatsApp Business, ligadas à mão. */
export type OrigemManual = {
  user_id: string; canal: 'direto' | 'whatsapp' | 'indicacao' | 'outro'
  escola: string | null; ano: string | null; cidade: string | null; estado: string | null; curso: string | null; observacao: string | null
}

export const CANAL_LABEL: Record<ContaOrigem['canal'], string> = {
  whatsapp: 'WhatsApp', direto: 'Contato direto', indicacao: 'Indicação', outro: 'Outro',
}

/** Uma linha por escola entre as contas ligadas: é o que vira chip na mesa de alunos. */
export function escolasDasContas(contas: Record<string, ContaOrigem>): { escola: string; curto: string; slug: string; total: number }[] {
  const m = new Map<string, number>()
  for (const c of Object.values(contas)) m.set(c.escola, (m.get(c.escola) ?? 0) + 1)
  return [...m.entries()].map(([escola, total]) => ({ escola, curto: escolaCurta(escola), slug: escolaSlug(escola), total })).sort((a, b) => b.total - a.total)
}

/** Linha de support.contatos_whatsapp: ponte conta ↔ telefone feita pelo cruzamento em camadas (scripts/duka_contatos.py). */
export type ContatoWs = { user_id: string; telefone: string; escola: string | null; ano: string | null; como: string | null }

/**
 * Forma canônica de um celular brasileiro: 55 + DDD + 9 + 8 dígitos.
 * O WhatsApp mostra números antigos sem o nono dígito ("+55 38 8848-9549") e o
 * aluno digita com ("38 98848-9549") — sem canonizar, os dois nunca casam.
 */
export function telefoneNorm(s: string | null | undefined): string {
  let d = String(s ?? '').replace(/[^0-9]/g, '')
  if (!d) return ''
  d = d.replace(/^0+/, '')
  if ((d.length === 10 || d.length === 11) && !d.startsWith('55')) d = `55${d}`
  if (d.length === 12 && d.charAt(4) >= '6' && d.charAt(4) <= '9') d = `${d.slice(0, 4)}9${d.slice(4)}`
  return d
}

export const STATUS_META: Record<StatusAluno, { label: string; cor: string }> = {
  respondeu:     { label: 'Respondeu',               cor: 'rgb(14 148 105)' },
  nao_respondeu: { label: 'Não respondeu',           cor: 'rgb(217 119 6)' },
  sem_dados:     { label: 'Sem dados (conversa vazia)', cor: 'rgb(var(--muted))' },
}

// ── CSV ─────────────────────────────────────────────────────────────────────
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  const t = texto.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += c
    } else if (c === '"') aspas = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((x) => x.trim() !== '')) linhas.push(linha)
      linha = []
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); if (linha.some((x) => x.trim() !== '')) linhas.push(linha) }
  return linhas
}

// ── normalização ────────────────────────────────────────────────────────────
export const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Escolas conhecidas: apelido → nome canônico → nome curto (o dos balões).
 * A ordem importa: a primeira regra que casar vence. Escola nova que ainda não
 * está aqui entra com o nome limpo que veio do WhatsApp e ganha um nome curto
 * automático (`escolaCurta`). Pra dar apelido a uma escola nova, basta
 * acrescentar uma linha.
 */
export const ESCOLAS: { casa: RegExp; nome: string; curto: string }[] = [
  { casa: /plinio|normal/,   nome: 'E.E. Prof. Plínio Ribeiro', curto: 'Escola Normal' },
  { casa: /alcides|polivalente/, nome: 'E.E. Prof. Alcides de Carvalho', curto: 'Polivalente' },
  { casa: /atenas/,          nome: 'Colégio Atenas',            curto: 'Atenas' },
  { casa: /teresinha/,       nome: 'Colégio Santa Teresinha',   curto: 'Santa Teresinha' },
  { casa: /etapa/,           nome: 'Pré-vestibular Etapa',      curto: 'Etapa' },
  { casa: /salesian/,        nome: 'Salesianos Santa Rosa',     curto: 'Salesianos' },
]

/** Nome canônico da escola a partir do que a pessoa escreveu. */
export function escolaDe(bruta: string): string {
  const s = semAcento(bruta)
  if (!s) return 'Não informada'
  for (const e of ESCOLAS) if (e.casa.test(s)) return e.nome
  // Escola nova: limpa o que sobrou (ex.: "escola estadual são josé" → "São José").
  const limpo = bruta.trim().replace(/\s+/g, ' ')
  return limpo.length > 2 ? limpo.replace(/^./, (c) => c.toUpperCase()) : `Outra (${limpo})`
}

/** Nome curto pra caber num balão. Cai no automático se não há apelido. */
export function escolaCurta(nome: string): string {
  const e = ESCOLAS.find((x) => x.nome === nome)
  if (e) return e.curto
  if (nome.length <= 18) return nome
  const sem = nome
    .replace(/\b(e\.?\s*e\.?|escola\s+estadual|escola\s+municipal|escola|colegio|colégio|instituto|centro\s+educacional|prof\.?a?|professora?|estadual|municipal)\b\.?/gi, ' ')
    .replace(/\s+/g, ' ').trim()
  const base = sem || nome
  return base.length > 18 ? `${base.slice(0, 17).trimEnd()}…` : base
}

/** Slug estável pra URL (`?f=escola:<slug>`). */
export const escolaSlug = (nome: string) => semAcento(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function anoDe(bruto: string, obs: string): { ano: AnoAluno; professor: boolean } {
  const s = semAcento(bruto)
  const o = semAcento(obs)
  if (s.includes('professor') || o.includes('e professor') || o.includes('e professora')) return { ano: 'Professor(a)', professor: true }
  // "1º, 2º e 3º ano" — quem dá aula em todas as séries
  if (/1.*2.*3/.test(s) && o.includes('professor')) return { ano: 'Professor(a)', professor: true }
  if (/\b1\b|primeiro|1º|1°|1-/.test(s)) return { ano: '1º ano', professor: false }
  if (/\b2\b|segundo|2º|2°|2•/.test(s)) return { ano: '2º ano', professor: false }
  if (/\b3\b|terceiro|3º|3°|3•/.test(s)) return { ano: '3º ano', professor: false }
  return { ano: 'Não informado', professor: false }
}

function statusDe(bruto: string): StatusAluno {
  const s = semAcento(bruto)
  if (s.startsWith('respondeu')) return 'respondeu'
  if (s.includes('sem dados')) return 'sem_dados'
  return 'nao_respondeu'
}

// ── carga ───────────────────────────────────────────────────────────────────
export const ARQUIVO_ALUNOS = path.join(process.cwd(), 'data', 'alunos_duka.csv')

export function carregarAlunos(): { alunos: Aluno[]; atualizadoEm: string | null } {
  if (!fs.existsSync(ARQUIVO_ALUNOS)) return { alunos: [], atualizadoEm: null }
  const texto = fs.readFileSync(ARQUIVO_ALUNOS, 'utf8')
  const [cab, ...linhas] = parseCsv(texto)
  const idx = (nome: string) => cab.findIndex((c) => semAcento(c) === semAcento(nome))
  const iContato = idx('Contato WhatsApp'), iNome = idx('Nome'), iTel = idx('Telefone informado')
  const iEscola = idx('Escola'), iAno = idx('Ano'), iStatus = idx('Status'), iObs = idx('Observação')
  const col = (l: string[], i: number) => (i >= 0 ? (l[i] ?? '').trim() : '')

  const alunos: Aluno[] = linhas.map((l) => {
    const anoBruto = col(l, iAno), obs = col(l, iObs)
    const { ano, professor } = anoDe(anoBruto, obs)
    return {
      contato: col(l, iContato),
      nome: col(l, iNome),
      telefone: col(l, iTel),
      escolaBruta: col(l, iEscola),
      escola: col(l, iNome) ? escolaDe(col(l, iEscola)) : 'Não informada',
      anoBruto,
      ano,
      professor,
      status: statusDe(col(l, iStatus)),
      obs,
      conta: null,
    }
  })
  const atualizadoEm = fs.statSync(ARQUIVO_ALUNOS).mtime.toISOString()
  return { alunos, atualizadoEm }
}

/**
 * Mesma lista, vinda do banco (support.alunos_whatsapp, migration 089): é o
 * que o scan do WhatsApp (bot, rotina das 21h ou botão "Escanear agora") grava.
 * Se a tabela estiver vazia, o painel cai no CSV — assim a tela nunca fica vazia.
 */
export type LinhaScan = {
  telefone: string; contato: string | null; nome: string | null; telefone_informado: string | null
  escola_bruta: string | null; ano_bruto: string | null; status: string | null; observacao: string | null
  cadastrado_no_bot: boolean; registrado_no_app: boolean; ultima_msg: string | null; atualizado_em: string
}
export type ScanRun = {
  id: number; origem: string; status: 'solicitado' | 'rodando' | 'concluido' | 'falhou'
  solicitado_em: string; iniciado_em: string | null; concluido_em: string | null; total: number | null; erro: string | null
}

export function alunosDeLinhas(linhas: LinhaScan[]): { alunos: Aluno[]; atualizadoEm: string | null } {
  let ultimo: string | null = null
  const alunos: Aluno[] = linhas.map((l) => {
    const anoBruto = l.ano_bruto ?? '', obs = l.observacao ?? ''
    const { ano, professor } = anoDe(anoBruto, obs)
    if (!ultimo || l.atualizado_em > ultimo) ultimo = l.atualizado_em
    return {
      contato: l.contato ?? l.telefone,
      nome: l.nome ?? '',
      telefone: l.telefone_informado ?? '',
      escolaBruta: l.escola_bruta ?? '',
      escola: l.nome ? escolaDe(l.escola_bruta ?? '') : 'Não informada',
      anoBruto,
      ano,
      professor,
      status: statusDe(l.status ?? (l.nome ? 'respondeu' : 'nao_respondeu')),
      obs,
      conta: null,
    }
  })
  return { alunos, atualizadoEm: ultimo }
}

/** A planilha em CSV (mesmas colunas do arquivo manual), pra baixar do painel. */
export function alunosParaCsv(alunos: Aluno[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const linhas = [['Contato WhatsApp', 'Nome', 'Telefone informado', 'Escola', 'Ano', 'Status', 'Observação', 'Conta no app'].join(',')]
  for (const a of alunos) {
    linhas.push([a.contato, a.nome, a.telefone, a.escola, a.ano, STATUS_META[a.status].label, a.obs, a.conta ? 'SIM' : 'NÃO'].map(esc).join(','))
  }
  return '\ufeff' + linhas.join('\r\n')
}

// ── resumo + cruzamento com as contas do app ────────────────────────────────
/**
 * Liga cada linha da planilha a uma conta do app, nesta ordem de confiança:
 *   1. `support.contatos_whatsapp` (cruzamento em camadas feito pelo script, inclui os manuais)
 *   2. telefone do cadastro do app (`users.phone`) igual ao número do WhatsApp
 *   3. nome completo igual (sem acento)
 * `users` não guarda escola — a planilha do WhatsApp é a única fonte, por isso
 * o esforço em achar a ponte. Quem não casa por nenhuma fica "Sem escola identificada".
 */
export function resumirAlunos(
  base: { alunos: Aluno[]; atualizadoEm: string | null; arquivo?: string },
  pessoas: Pessoa[],
  pontes: { contatos?: ContatoWs[]; telefones?: Map<string, string | null>; origens?: OrigemManual[] } = {},
): ResumoAlunos {
  const porId = new Map(pessoas.map((p) => [p.id, p]))
  const porNome = new Map<string, Pessoa>()
  for (const p of pessoas) {
    const n = semAcento(p.nome ?? '')
    if (n && !porNome.has(n)) porNome.set(n, p)
  }
  const porTelefone = new Map<string, number>()   // telefone → índice em base.alunos
  base.alunos.forEach((a, i) => {
    for (const t of [telefoneNorm(a.contato), telefoneNorm(a.telefone)]) if (t && !porTelefone.has(t)) porTelefone.set(t, i)
  })
  const contaDe = new Map<number, Pessoa>()      // índice → conta
  const usada = new Set<string>()
  const liga = (i: number | undefined, p: Pessoa | undefined) => {
    if (i === undefined || !p || contaDe.has(i) || usada.has(p.id)) return
    contaDe.set(i, p); usada.add(p.id)
  }
  const contas: ResumoAlunos['contas'] = {}
  // 1. contatos_whatsapp
  for (const c of pontes.contatos ?? []) {
    const p = porId.get(c.user_id)
    if (!p) continue
    liga(porTelefone.get(telefoneNorm(c.telefone)), p)
    if (c.escola) contas[p.id] = { escola: escolaDe(c.escola), ano: c.ano ?? 'Não informado', como: c.como ?? 'planilha', canal: 'whatsapp' }
  }
  // 2. telefone do cadastro
  for (const p of pessoas) liga(porTelefone.get(telefoneNorm(pontes.telefones?.get(p.id))), p)
  // 3. nome igual
  base.alunos.forEach((a, i) => { const n = semAcento(a.nome); if (n) liga(i, porNome.get(n)) })

  const alunos = base.alunos.map((a, i) => {
    const p = contaDe.get(i)
    if (p && !contas[p.id]) contas[p.id] = { escola: a.escola, ano: a.ano, como: 'planilha', canal: 'whatsapp' }
    return { ...a, conta: p ? { id: p.id, nome: p.nome, grupo: p.grupo, criado: p.criado } : null }
  })
  // 4. origem manual (contato direto, antes do bot): só quem ainda não casou com a planilha
  for (const o of pontes.origens ?? []) {
    const p = porId.get(o.user_id)
    if (!p || contas[p.id]) continue
    contas[p.id] = {
      escola: o.escola ? escolaDe(o.escola) : 'Contato direto',
      ano: o.ano ?? 'Não informado', como: 'manual', canal: o.canal, cidade: o.cidade, curso: o.curso,
    }
  }

  const conta = (f: (a: Aluno) => boolean) => alunos.filter(f).length
  const agrupa = (chave: (a: Aluno) => string, filtro: (a: Aluno) => boolean = () => true) => {
    const m = new Map<string, number>()
    for (const a of alunos) if (filtro(a)) m.set(chave(a), (m.get(chave(a)) ?? 0) + 1)
    return [...m.entries()].sort((x, y) => y[1] - x[1]).map(([label, value]) => ({ label, value }))
  }

  // Observações viram avisos agrupados por assunto — é o que pede ação.
  const tipoDe = (obs: string): string | null => {
    const o = semAcento(obs)
    if (!o) return null
    if (o.includes('codigo') || o.includes('cadastro') || o.includes('cade o aplicativo') || o.includes('android') || o.includes('testflight')) return 'Travou pra entrar no app'
    if (o.includes('duplicata')) return 'Possível duplicata'
    if (o.includes('telefone')) return 'Telefone difere do WhatsApp'
    if (o.includes('professor')) return 'É professor(a), não aluno'
    if (o.includes('primeiro nome') || o.includes('nome incompleto') || o.includes('dados estavam errados')) return 'Nome incompleto ou errado'
    if (o.includes('deu certo')) return 'Confirmou que entrou'
    return 'Outras observações'
  }
  const avisosMap = new Map<string, { nome: string; contato: string; obs: string }[]>()
  for (const a of alunos) {
    const t = tipoDe(a.obs)
    if (!t) continue
    ;(avisosMap.get(t) ?? avisosMap.set(t, []).get(t)!).push({ nome: a.nome || '(sem nome)', contato: a.contato, obs: a.obs })
  }
  const ordem = ['Travou pra entrar no app', 'Possível duplicata', 'Nome incompleto ou errado', 'Telefone difere do WhatsApp', 'É professor(a), não aluno', 'Confirmou que entrou', 'Outras observações']
  const avisos = ordem.filter((t) => avisosMap.has(t)).map((t) => ({ tipo: t, itens: avisosMap.get(t)! }))

  return {
    arquivo: base.arquivo ?? 'data/alunos_duka.csv',
    atualizadoEm: base.atualizadoEm,
    alunos,
    total: alunos.length,
    responderam: conta((a) => a.status === 'respondeu'),
    naoResponderam: conta((a) => a.status === 'nao_respondeu'),
    semDados: conta((a) => a.status === 'sem_dados'),
    professores: conta((a) => a.professor),
    comConta: conta((a) => !!a.conta),
    escolas: agrupa((a) => a.escola, (a) => a.status === 'respondeu'),
    porEscola: [...new Set(alunos.filter((a) => a.nome).map((a) => a.escola))]
      .map((escola) => ({
        escola,
        curto: escolaCurta(escola),
        slug: escolaSlug(escola),
        total: conta((a) => a.escola === escola && !!a.nome),
        responderam: conta((a) => a.escola === escola && a.status === 'respondeu'),
        comConta: Object.values(contas).filter((c) => c.escola === escola).length,
        professores: conta((a) => a.escola === escola && a.professor),
      }))
      .sort((x, y) => y.total - x.total),
    anos: agrupa((a) => a.ano, (a) => a.status === 'respondeu'),
    avisos,
    duplicatas: alunos.filter((a) => semAcento(a.obs).includes('duplicata')),
    contas,
  }
}
