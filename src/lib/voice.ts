// Ponte com o sidecar de TTS (jarvis-voice/, Chatterbox Multilingual).
// Server-only (importado só por server actions/pages).
//  - synthesizeBytes(text)  → WAV em memória (respostas do chat por voz)
//  - synthesize(id, text)   → WAV gravado na vault (resumo de relatório), idempotente

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { audioAbsPath, audioExists } from './obsidian'

const URL_BASE = () => (process.env.JARVIS_VOICE_URL ?? 'http://127.0.0.1:8765').replace(/\/+$/, '')

export type VoiceStatus = { online: boolean; device?: string; loaded?: boolean; voice?: boolean }

export async function voiceStatus(): Promise<VoiceStatus> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const r = await fetch(`${URL_BASE()}/health`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!r.ok) return { online: false }
    const j = await r.json()
    return { online: true, device: j.device, loaded: !!j.loaded, voice: !!j.voice }
  } catch {
    return { online: false }
  }
}

/** Sintetiza e devolve os bytes do WAV. Lança com mensagem amigável se o sidecar estiver fora. */
export async function synthesizeBytes(text: string): Promise<Buffer> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 180_000)   // 1ª chamada carrega o modelo
  let r: Response
  try {
    r = await fetch(`${URL_BASE()}/tts`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language_id: 'pt', exaggeration: 0.5, cfg_weight: 0.5 }),
    })
  } catch {
    throw new Error('JARVIS Voice está desligado. Rode jarvis-voice\\start.ps1 e tente de novo.')
  } finally {
    clearTimeout(t)
  }
  if (!r.ok) throw new Error(`voz: ${r.status} ${(await r.text()).slice(0, 200)}`)
  return Buffer.from(await r.arrayBuffer())
}

/** Sintetiza o resumo do relatório `id` e grava na vault. Idempotente. */
export async function synthesize(id: number, text: string): Promise<string> {
  const out = audioAbsPath(id)
  if (!out) throw new Error('OBSIDIAN_VAULT não configurada no .env.local')
  if (await audioExists(id)) return out
  const buf = await synthesizeBytes(text)
  await fs.mkdir(path.dirname(out), { recursive: true })
  await fs.writeFile(out, buf)
  return out
}
