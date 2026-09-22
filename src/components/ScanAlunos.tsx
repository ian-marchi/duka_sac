'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { solicitarScan } from '@/app/(painel)/alunos/actions'
import type { ScanRun } from '@/lib/alunos'

const fmt = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Estado do scan do WhatsApp + botão de forçar um agora.
 * Enquanto há pedido em aberto, recarrega a página a cada 15 s pra mostrar
 * quando o bot/rotina terminou — sem websocket, sem complicação.
 */
export function ScanAlunos({ ultimo, aberto, atualizadoEm, total }: {
  ultimo: ScanRun | null; aberto: ScanRun | null; atualizadoEm: string | null; total: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const emAberto = !!aberto

  useEffect(() => {
    if (!emAberto) return
    const t = setInterval(() => router.refresh(), 15_000)
    return () => clearInterval(t)
  }, [emAberto, router])

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <div className="text-fg2">
        <span className="kicker">Planilha do WhatsApp</span>{' '}
        <b>{total}</b> contatos · atualizada {fmt(atualizadoEm)}
        {ultimo && ultimo.status === 'falhou' && <span className="ml-2 text-p0" title={ultimo.erro ?? ''}>último scan falhou</span>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {emAberto ? (
          <span className="chip chip-on animate-pulse" title={`pedido #${aberto!.id} (${aberto!.origem}) às ${fmt(aberto!.solicitado_em)}`}>
            {aberto!.status === 'rodando' ? 'Escaneando…' : 'Aguardando o WhatsApp…'}
          </span>
        ) : (
          <button
            type="button"
            className="clay px-3 py-1 text-[11px]"
            disabled={pending}
            onClick={() => start(async () => {
              setErro(null)
              const r = await solicitarScan()
              if (!r.ok) setErro(r.erro ?? 'não deu')
              router.refresh()
            })}
            title="Pede uma varredura do WhatsApp agora, fora das 21h. Quem executa é o bot ou a rotina do Claude."
          >
            {pending ? 'Pedindo…' : 'Escanear agora'}
          </button>
        )}
        <a className="chip" href="/api/alunos/planilha" title="Baixa a planilha atual em CSV">Baixar CSV</a>
      </div>
      {erro && <div className="w-full text-p0">Não consegui pedir o scan: {erro}</div>}
    </div>
  )
}
