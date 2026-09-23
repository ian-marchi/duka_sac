'use client'

import { useState, useTransition } from 'react'
import { liberarWhatsapp, descartarWhatsapp } from '@/app/(painel)/t/[id]/actions'

// Botões de um rascunho de WhatsApp: Liberar (draft→queued) / Descartar (draft→skipped).
export function RascunhoAcoes({ outboxId }: { outboxId: number }) {
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function rodar(fn: (id: number) => Promise<{ error?: string; ok?: boolean }>) {
    start(async () => {
      setErro(null)
      const r = await fn(outboxId)
      if (r?.error) setErro(r.error)
    })
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <button
        disabled={pending}
        onClick={() => rodar(liberarWhatsapp)}
        className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Liberar
      </button>
      <button
        disabled={pending}
        onClick={() => rodar(descartarWhatsapp)}
        className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-elev disabled:opacity-50"
      >
        Descartar
      </button>
      {erro && <span className="text-xs text-p0">{erro}</span>}
    </div>
  )
}
