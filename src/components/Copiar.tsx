'use client'

import { useState } from 'react'

/**
 * Texto com botão de copiar ao lado. Pra e-mail e telefone no perfil do aluno:
 * o suporte precisa colar isso no WhatsApp ou no Supabase sem selecionar à mão.
 */
export function Copiar({ texto, mostrar, href, titulo }: { texto: string; mostrar?: string; href?: string; titulo?: string }) {
  const [ok, setOk] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setOk(true)
      setTimeout(() => setOk(false), 1200)
    } catch { /* sem clipboard (http sem https): o texto continua selecionável */ }
  }
  const conteudo = mostrar ?? texto
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      {href
        ? <a href={href} target="_blank" rel="noreferrer" className="truncate hover:underline" title={titulo}>{conteudo}</a>
        : <span className="truncate select-all" title={titulo}>{conteudo}</span>}
      <button
        type="button"
        onClick={copiar}
        className="shrink-0 rounded-md border px-1 text-[10px] leading-4 text-muted hover:bg-elev hover:text-fg"
        title={`copiar ${texto}`}
        aria-label="copiar"
      >
        {ok ? '✓' : '⧉'}
      </button>
    </span>
  )
}
