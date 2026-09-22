// Escreve relatórios como notas .md direto na vault do Obsidian.
// Server-only (usa fs): importado apenas por server actions, route handlers e
// server components. O caminho vem de OBSIDIAN_VAULT no .env.local.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Report } from './types'
import { REPORT_KIND_META } from './types'

const ROOT = 'Relatórios'
export const AUDIO_DIR = path.join(ROOT, 'audio')

export function vaultPath(): string | null {
  const v = process.env.OBSIDIAN_VAULT?.trim()
  return v ? v : null
}

export const audioFileName = (id: number) => `relatorio-${id}.wav`

export function audioAbsPath(id: number): string | null {
  const v = vaultPath()
  return v ? path.join(v, AUDIO_DIR, audioFileName(id)) : null
}

export async function audioExists(id: number): Promise<boolean> {
  const p = audioAbsPath(id)
  if (!p) return false
  try { await fs.access(p); return true } catch { return false }
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).toLowerCase()
}

function stampSP(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    time: d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':', 'h'),
  }
}

/** Nome do arquivo: `2026-09-04 08h00 · resumo-diario.md` dentro da pasta do tipo. */
export function noteRelPath(r: Report): string {
  const { date, time } = stampSP(r.created_at)
  const meta = REPORT_KIND_META[r.kind]
  return path.join(ROOT, meta.folder, `${date} ${time} · ${slug(r.title) || r.kind}.md`)
}

/** Grava (ou regrava) a nota. Devolve o caminho absoluto, ou null se não há vault. */
export async function writeReportNote(r: Report): Promise<string | null> {
  const v = vaultPath()
  if (!v) return null
  const rel = noteRelPath(r)
  const abs = path.join(v, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.mkdir(path.join(v, AUDIO_DIR), { recursive: true })

  const hasAudio = await audioExists(r.id)
  const meta = REPORT_KIND_META[r.kind]
  const front = [
    '---',
    `tipo: ${r.kind}`,
    `titulo: "${r.title.replace(/"/g, "'")}"`,
    `gerado_em: ${r.created_at}`,
    `periodo_dias: ${r.period_days}`,
    `modelo: ${r.model ?? ''}`,
    `tokens: ${r.tokens ?? 0}`,
    `custo_usd: ${r.cost_usd ?? 0}`,
    `por: ${r.generated_by}`,
    `tags: [duka, relatorio, ${r.kind}]`,
    '---',
    '',
  ].join('\n')

  const audioBlock = hasAudio
    ? `\n> [!tip] Ouvir o resumo\n> ![[audio/${audioFileName(r.id)}]]\n\n`
    : ''

  const body = `${front}${audioBlock}${r.body_md.trim()}\n\n---\n*${meta.icon} ${meta.label} · gerado pelo JARVIS do painel Duka · [[Duka]]*\n`
  await fs.writeFile(abs, body, 'utf8')
  return abs
}
