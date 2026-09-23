// Séries de "quem entrou no app" por dia / semana / mês — sem dependências.
//
// O servidor manda os dados crus e compactos (Bruto); os gráficos da visão
// geral agrupam no navegador, então trocar Dia/Semana/Mês ou arrastar um
// intervalo é instantâneo. "Entrou" = tem linha em app_opens naquele dia
// (usuários distintos); "aberturas" = soma de app_opens.aberturas; "novos" =
// contas criadas (users.created_at).

import { addDays, diffDays } from './analytics'

export type Gran = 'dia' | 'semana' | 'mes'
export type Metrica = 'ativos' | 'aberturas' | 'novos'

/** criados[i] = dia de criação da conta i; opens = [dia, i, aberturas]. */
export type Bruto = { criados: string[]; opens: [string, number, number][] }

export type Valores = { ativos: number; aberturas: number; novos: number }
export type Balde = Valores & { chave: string; inicio: string; fim: string; rotulo: string; titulo: string }

export const METRICA_META: Record<Metrica, { label: string; curto: string; cor: string; desc: string }> = {
  ativos:    { label: 'Usuários que entraram', curto: 'entraram',  cor: 'rgb(var(--brand))', desc: 'pessoas distintas que abriram o app' },
  aberturas: { label: 'Aberturas do app',      curto: 'aberturas', cor: 'rgb(56 152 236)',   desc: 'soma das aberturas registradas' },
  novos:     { label: 'Novos cadastros',       curto: 'novos',     cor: 'rgb(var(--ok))',    desc: 'contas criadas' },
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`
export const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() // 0 = domingo

/** Primeiro dia do balde que contém `dia` (semana começa na segunda). */
export function inicioBalde(dia: string, g: Gran): string {
  if (g === 'dia') return dia
  if (g === 'mes') return `${dia.slice(0, 7)}-01`
  return addDays(dia, -((dow(dia) + 6) % 7))
}

function fimBalde(inicio: string, g: Gran): string {
  if (g === 'dia') return inicio
  if (g === 'semana') return addDays(inicio, 6)
  const [y, m] = inicio.split('-').map(Number)
  return addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1)
}

function rotular(inicio: string, fim: string, g: Gran): { rotulo: string; titulo: string } {
  const mes = Number(inicio.slice(5, 7)) - 1
  if (g === 'dia') return { rotulo: dm(inicio), titulo: `${SEMANA[dow(inicio)]}, ${dmy(inicio)}` }
  if (g === 'semana') return { rotulo: dm(inicio), titulo: `semana de ${dm(inicio)} a ${dm(fim)}` }
  return { rotulo: `${MES[mes]}/${inicio.slice(2, 4)}`, titulo: `${MES_LONGO[mes]} de ${inicio.slice(0, 4)}` }
}

/** Índice por dia, montado uma vez e reaproveitado por todos os gráficos. */
export type Indice = { porDia: Map<string, { u: number[]; ab: number }>; novos: Map<string, number>; primeiro: string | null }

export function indexar(b: Bruto): Indice {
  const porDia = new Map<string, { u: number[]; ab: number }>()
  let primeiro: string | null = null
  for (const [dia, u, ab] of b.opens) {
    const x = porDia.get(dia) ?? porDia.set(dia, { u: [], ab: 0 }).get(dia)!
    x.u.push(u); x.ab += ab
    if (!primeiro || dia < primeiro) primeiro = dia
  }
  const novos = new Map<string, number>()
  for (const c of b.criados) {
    novos.set(c, (novos.get(c) ?? 0) + 1)
    if (!primeiro || c < primeiro) primeiro = c
  }
  return { porDia, novos, primeiro }
}

/** Totais de [de, ate] — "ativos" conta cada pessoa uma vez no intervalo todo. */
export function resumo(ix: Indice, de: string, ate: string): Valores {
  const pessoas = new Set<number>()
  let aberturas = 0, novos = 0
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    const x = ix.porDia.get(d)
    if (x) { for (const u of x.u) pessoas.add(u); aberturas += x.ab }
    novos += ix.novos.get(d) ?? 0
  }
  return { ativos: pessoas.size, aberturas, novos }
}

/** Baldes de [de, ate] na granularidade pedida (as pontas ficam cortadas no intervalo). */
export function baldes(ix: Indice, de: string, ate: string, g: Gran): Balde[] {
  const out: Balde[] = []
  if (de > ate) return out
  for (let ini = inicioBalde(de, g); ini <= ate; ini = addDays(fimBalde(ini, g), 1)) {
    const fim = fimBalde(ini, g)
    const a = ini < de ? de : ini
    const z = fim > ate ? ate : fim
    out.push({ chave: ini, inicio: a, fim: z, ...rotular(ini, fim, g), ...resumo(ix, a, z) })
  }
  return out
}

/** Janela anterior de mesmo tamanho (para comparar "vs período anterior"). */
export function anterior(de: string, ate: string): { de: string; ate: string } {
  const n = diffDays(de, ate) + 1
  return { de: addDays(de, -n), ate: addDays(de, -1) }
}

/** Variação percentual; null quando não dá para comparar. */
export function variacao(atual: number, antes: number): number | null {
  if (!antes) return atual ? null : 0
  return ((atual - antes) / antes) * 100
}

export function granPadrao(de: string, ate: string): Gran {
  const n = diffDays(de, ate) + 1
  return n <= 62 ? 'dia' : n <= 240 ? 'semana' : 'mes'
}
