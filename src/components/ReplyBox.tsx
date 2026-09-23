'use client'

import { useState, useTransition } from 'react'
import type { WhatsappTemplate } from '@/lib/types'
import { enviarWhatsapp } from '@/app/(painel)/t/[id]/actions'

// rótulo de cada modelo 'resposta:<nome>' no seletor
const ROTULO: Record<string, string> = {
  questao: 'Erro em questão', bug: 'Erro do app', sugestao: 'Sugestão',
  pc: 'Versão para computador', voz: 'Leitura em voz alta', default: 'Genérica',
}

/**
 * Resposta do ticket pelo WhatsApp (migration 091). Não envia nada daqui:
 * só insere em support.whatsapp_outbox como rascunho ('draft', o bot ignora)
 * ou na fila ('queued', o bot duka_whas_bot manda ao rodar).
 */
export function ReplyBox({ id, ref_, titulo, reporterName, phone, templates }: {
  id: number
  ref_: string
  titulo: string
  reporterName: string | null
  phone: string | null
  templates: WhatsappTemplate[]
}) {
  const [numero, setNumero] = useState(phone ?? '')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function fill(chave: string) {
    const t = templates.find((x) => x.chave === chave)
    if (!t) return
    const nome = reporterName?.trim().split(' ')[0] || 'tudo bem'
    setBody(t.corpo.replaceAll('{nome}', nome).replaceAll('{ref}', ref_).replaceAll('{titulo}', titulo))
  }

  function salvar(status: 'draft' | 'queued') {
    start(async () => {
      setMsg(null)
      const r = await enviarWhatsapp(id, numero, body, status)
      if (r?.error) setMsg(r.error)
      else { setMsg(status === 'draft' ? 'Rascunho salvo ✓' : 'Na fila do WhatsApp ✓'); setBody('') }
    })
  }

  const semNumero = !numero.replace(/\D/g, '')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Modelo:</span>
        <select
          onChange={(e) => { if (e.target.value) fill(e.target.value) }}
          defaultValue=""
          className="rounded-lg border bg-bg px-2 py-1 text-sm outline-none"
        >
          <option value="">escolher…</option>
          {templates.map((t) => {
            const nome = t.chave.replace(/^resposta:/, '')
            return <option key={t.chave} value={t.chave}>{ROTULO[nome] ?? nome}</option>
          })}
        </select>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          para
          {!phone && <span className="text-p1">sem número ·</span>}
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="55 DDD número"
            className="w-40 rounded-lg border bg-bg px-2 py-1 font-mono text-xs outline-none focus:border-brand"
          />
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full rounded-lg border bg-bg p-3 text-sm outline-none focus:border-brand"
        placeholder="Escreva a resposta…"
      />
      {msg && <p className="text-xs text-p1">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending || !body.trim()}
          onClick={() => salvar('draft')}
          className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-elev disabled:opacity-50"
        >
          Salvar rascunho
        </button>
        <button
          disabled={pending || !body.trim() || semNumero}
          onClick={() => salvar('queued')}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Enviar pelo WhatsApp'}
        </button>
      </div>
    </div>
  )
}
