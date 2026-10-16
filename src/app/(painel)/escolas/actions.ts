'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Escolas parceiras (migration 117). O diretor paga; a lista de alunos dele
 * ganha Premium enquanto a escola estiver ativa. Tudo aqui roda com a sessão
 * do admin (RLS `support.is_admin()`); quem aplica/tira Premium é o banco.
 */

type R = { ok: boolean; erro?: string; info?: string }

export async function criarEscola(form: FormData): Promise<R> {
  const nome = String(form.get('nome') ?? '').trim()
  if (!nome) return { ok: false, erro: 'Nome da escola é obrigatório.' }
  const supabase = await supabaseServer()
  const { error } = await supabase.from('escolas').insert({
    nome,
    cidade: str(form.get('cidade')), uf: str(form.get('uf'))?.toUpperCase().slice(0, 2) ?? null,
    contato_nome: str(form.get('contato_nome')), contato_telefone: str(form.get('contato_telefone')), contato_email: str(form.get('contato_email'))?.toLowerCase() ?? null,
    premium_ate: str(form.get('premium_ate')), obs: str(form.get('obs')),
  })
  revalidatePath('/escolas')
  return error ? { ok: false, erro: error.message } : { ok: true }
}

export async function editarEscola(id: string, form: FormData): Promise<R> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('escolas').update({
    nome: str(form.get('nome')) ?? undefined,
    cidade: str(form.get('cidade')), uf: str(form.get('uf'))?.toUpperCase().slice(0, 2) ?? null,
    contato_nome: str(form.get('contato_nome')), contato_telefone: str(form.get('contato_telefone')), contato_email: str(form.get('contato_email'))?.toLowerCase() ?? null,
    premium_ate: str(form.get('premium_ate')), obs: str(form.get('obs')), atualizado_em: new Date().toISOString(),
  }).eq('id', id)
  revalidatePath(`/escolas/${id}`)
  if (error) return { ok: false, erro: error.message }
  // premium_ate mudou → reaplica nos alunos
  await supabase.rpc('escola_vincular', { p_escola: id })
  return { ok: true }
}

export async function mudarStatus(id: string, status: 'ativa' | 'pausada' | 'encerrada'): Promise<R> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('escola_status', { p_escola: id, p_status: status })
  revalidatePath(`/escolas/${id}`); revalidatePath('/escolas')
  return error ? { ok: false, erro: error.message } : { ok: true, info: JSON.stringify(data) }
}

/**
 * Cola a lista como vem do WhatsApp (nome numa linha, e-mail e telefone nas
 * seguintes, com ou sem numeração) e vira linhas de escola_alunos.
 */
export async function adicionarAlunos(id: string, texto: string, dddPadrao = '34'): Promise<R & { n?: number; ignorados?: string[] }> {
  const alunos = parseLista(texto, dddPadrao)
  if (!alunos.length) return { ok: false, erro: 'Não achei nenhum aluno no texto. Precisa de nome e, na linha seguinte, e-mail ou telefone.' }
  const supabase = await supabaseServer()
  const ignorados: string[] = []
  let n = 0
  for (const a of alunos) {
    const { error } = await supabase.from('escola_alunos').upsert(
      { escola_id: id, nome: a.nome, email: a.email, telefone: a.telefone },
      { onConflict: 'escola_id,email', ignoreDuplicates: false },
    )
    if (error) {
      // sem e-mail não há conflito possível: insere direto
      const { error: e2 } = await supabase.from('escola_alunos').insert({ escola_id: id, nome: a.nome, email: a.email, telefone: a.telefone })
      if (e2) { ignorados.push(`${a.nome}: ${e2.message}`); continue }
    }
    n++
  }
  const { data } = await supabase.rpc('escola_vincular', { p_escola: id })
  revalidatePath(`/escolas/${id}`)
  return { ok: true, n, ignorados, info: JSON.stringify(data) }
}

export async function vincular(id: string): Promise<R> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('escola_vincular', { p_escola: id })
  revalidatePath(`/escolas/${id}`)
  return error ? { ok: false, erro: error.message } : { ok: true, info: JSON.stringify(data) }
}

export async function convidar(id: string, modelo: string | null): Promise<R> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('escola_convidar', { p_escola: id, p_modelo: modelo })
  revalidatePath(`/escolas/${id}`)
  return error ? { ok: false, erro: error.message } : { ok: true, info: JSON.stringify(data) }
}

export async function removerAluno(escolaId: string, alunoId: string): Promise<R> {
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('escola_aluno_remover', { p_aluno: alunoId })
  revalidatePath(`/escolas/${escolaId}`)
  return error ? { ok: false, erro: error.message } : { ok: true }
}

// ── parser da lista colada ──────────────────────────────────────────────────
const str = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s ? s : null }

export type AlunoColado = { nome: string; email: string | null; telefone: string | null }

/** Telefone BR canônico 55DDDNNNNNNNNN; números com 8–9 dígitos ganham o DDD padrão. */
function telefoneCanonico(bruto: string, ddd: string): string | null {
  let d = bruto.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  if (d.length === 8 || d.length === 9) d = ddd + d
  if (d.length === 10 && '6789'.includes(d[2])) d = d.slice(0, 2) + '9' + d.slice(2)
  if (d.length !== 11 || d[2] !== '9' || d[0] === '0') return null
  return '55' + d
}

export async function parseListaServer(texto: string, ddd = '34'): Promise<AlunoColado[]> { return parseLista(texto, ddd) }

function parseLista(texto: string, ddd: string): AlunoColado[] {
  const out: AlunoColado[] = []
  let atual: AlunoColado | null = null
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/i
  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trim()
    if (!linha || /^enviar para/i.test(linha)) continue
    const email = linha.match(EMAIL)?.[0]?.toLowerCase() ?? null
    const semEmail = email ? linha.replace(EMAIL, '') : linha
    const digitos = semEmail.replace(/\D/g, '')
    const pareceTelefone = /tel|fone|cel|whats/i.test(semEmail) || (digitos.length >= 8 && semEmail.replace(/[\d\s().\-+]/g, '').length <= 3)
    if (email || pareceTelefone) {
      if (!atual) { atual = { nome: '(sem nome)', email: null, telefone: null }; out.push(atual) }
      if (email && !atual.email) atual.email = email
      if (pareceTelefone && digitos.length >= 8 && !atual.telefone) atual.telefone = telefoneCanonico(digitos, ddd)
      continue
    }
    // linha de nome: tira numeração "1-", "4 ", "3)" etc.
    const nome = linha.replace(/^\s*\d+\s*[-.)]?\s*/, '').replace(/\s+/g, ' ').trim()
    if (nome.length < 3) continue
    atual = { nome: titulo(nome), email: null, telefone: null }
    out.push(atual)
  }
  return out.filter((a) => a.email || a.telefone)
}

function titulo(s: string): string {
  const minus = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return s.toLowerCase().split(' ').map((p, i) => (minus.has(p) && i > 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ')
}
