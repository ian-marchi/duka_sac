'use client'

import { useState, useTransition } from 'react'
import type { Priority, TicketStatus } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { setStatus, setPriority, saveNote } from '@/app/(painel)/t/[id]/actions'

const STATUSES: TicketStatus[] = [
  'new', 'triage', 'open', 'waiting_user', 'resolved', 'wont_fix', 'duplicate', 'archived',
]
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']

export function TicketActions({ id, status, priority, note }: {
  id: number
  status: TicketStatus
  priority: Priority
  note: string | null
}) {
  const [pending, start] = useTransition()
  const [noteText, setNoteText] = useState(note ?? '')
  const [noteSaved, setNoteSaved] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={priority}
        disabled={pending}
        onChange={(e) => start(async () => { await setPriority(id, e.target.value as Priority, priority) })}
        className="rounded-lg border bg-bg px-2 py-1 text-sm font-bold outline-none"
        title="Alterar prioridade (congela o motor automático)"
      >
        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <select
        value={status}
        disabled={pending}
        onChange={(e) => start(async () => { await setStatus(id, e.target.value as TicketStatus, status) })}
        className="rounded-lg border bg-bg px-2 py-1 text-sm outline-none"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>

      {status !== 'resolved' && (
        <button
          disabled={pending}
          onClick={() => start(async () => { await setStatus(id, 'resolved', status) })}
          className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Resolver
        </button>
      )}

      <details className="w-full">
        <summary className="cursor-pointer text-xs text-muted">Nota interna (só você vê)</summary>
        <div className="mt-2">
          <textarea
            value={noteText}
            onChange={(e) => { setNoteText(e.target.value); setNoteSaved(false) }}
            rows={2}
            className="w-full rounded-lg border bg-bg p-2 text-sm outline-none focus:border-brand"
            placeholder="Anotação privada…"
          />
          <button
            disabled={pending}
            onClick={() => start(async () => { await saveNote(id, noteText); setNoteSaved(true) })}
            className="mt-1 rounded-lg border px-2 py-1 text-xs hover:bg-bg disabled:opacity-50"
          >
            {noteSaved ? 'Salvo ✓' : 'Salvar nota'}
          </button>
        </div>
      </details>
    </div>
  )
}
