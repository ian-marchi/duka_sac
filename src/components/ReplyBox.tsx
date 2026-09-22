'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ReplyTemplate } from '@/lib/types'
import { sendReply } from '@/app/(painel)/t/[id]/actions'

export function ReplyBox({ id, toEmail, ref_, kind, reporterName, templates }: {
  id: number
  toEmail: string | null
  ref_: string
  kind: string
  reporterName: string | null
  templates: ReplyTemplate[]
}) {
  const [subject, setSubject] = useState('Sobre seu chamado')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const compatible = useMemo(
    () => templates.filter((t) => t.kind.length === 0 || t.kind.includes(kind)),
    [templates, kind],
  )

  function fill(id: string) {
    const t = compatible.find((x) => x.id === id)
    if (!t) return
    const nome = reporterName?.split(' ')[0] ?? 'tudo bem'
    setSubject(t.subject)
    setBody(t.body.replaceAll('{{nome}}', nome).replaceAll('{{ref}}', ref_))
  }

  if (!toEmail) {
    return (
      <div className="rounded-xl border border-dashed p-3 text-sm text-muted">
        Sem e-mail no ticket — não dá para responder por aqui.
      </div>
    )
  }

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
          {compatible.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="text-xs text-muted">para {toEmail}</span>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full rounded-lg border bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        placeholder="Assunto"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full rounded-lg border bg-bg p-3 text-sm outline-none focus:border-brand"
        placeholder="Escreva a resposta…"
      />
      {msg && <p className="text-xs text-p1">{msg}</p>}
      <button
        disabled={pending || !body.trim()}
        onClick={() => start(async () => {
          setMsg(null)
          const r = await sendReply(id, toEmail, subject, body)
          if (r?.error) setMsg(r.error)
          else { setMsg('Enviado ✓'); setBody('') }
        })}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Enviando…' : 'Enviar e marcar como Aguardando'}
      </button>
    </div>
  )
}
