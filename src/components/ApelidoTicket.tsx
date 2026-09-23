'use client'

import { useEffect, useState, useTransition } from 'react'
import { setApelido } from '@/app/(painel)/t/[id]/actions'

/**
 * Apelido do ticket no cabeçalho (migration 092). Clica para editar; Enter ou
 * sair do campo salva, Esc cancela. Vazio remove o apelido.
 */
export function ApelidoTicket({ id, apelido }: { id: number; apelido: string | null }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(apelido ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // trocar de ticket na mesa reaproveita o componente
  useEffect(() => { setTexto(apelido ?? ''); setEditando(false); setErro(null) }, [id, apelido])

  function salvar() {
    const novo = texto.replace(/\s+/g, ' ').trim()
    if (novo === (apelido ?? '')) { setEditando(false); return }
    start(async () => {
      const r = await setApelido(id, novo)
      if (r?.error) setErro(r.error)
      else { setErro(null); setEditando(false) }
    })
  }

  if (editando) {
    return (
      <div className="mt-1.5">
        <input
          autoFocus
          value={texto}
          maxLength={60}
          disabled={pending}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar()
            if (e.key === 'Escape') { setTexto(apelido ?? ''); setEditando(false) }
          }}
          placeholder="Apelido (ex.: explicação ao acertar)"
          className="w-full max-w-md rounded-lg border bg-bg px-2 py-1 font-display text-lg font-extrabold outline-none focus:border-brand"
        />
        {erro && <p className="mt-0.5 text-xs text-p0">{erro}</p>}
      </div>
    )
  }

  return apelido ? (
    <button
      onClick={() => setEditando(true)}
      title="Editar apelido"
      className="mt-1.5 block text-left font-display text-lg font-extrabold leading-tight text-brandText hover:underline"
    >
      🏷️ {apelido}
    </button>
  ) : (
    <button onClick={() => setEditando(true)} className="mt-1.5 block text-xs text-muted hover:text-brandText">
      🏷️ dar um apelido
    </button>
  )
}
