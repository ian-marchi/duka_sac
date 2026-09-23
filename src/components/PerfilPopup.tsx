'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/** O que o pop-up mostra de uma conta do app (só o que já está no painel). */
export type PerfilResumo = {
  id: string
  nome: string
  user: string | null
  email: string | null
  criado: string
  ultAb: string | null
  diasAt: number
  ab: number
  pontos: number
  premium: boolean
  grupoTag: string
  grupoCor: string
  exame: string | null
  curso: string | null
  idade: number | null
  tipoEscola: string | null
  ia: number
  /** o que a planilha do WhatsApp / contato direto sabe */
  escola: string | null
  ano: string | null
  canal: string | null
  cidade: string | null
  contato: string | null
  obs: string | null
}

const dt = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

/**
 * Botão "sim" da coluna "No app": abre um pop-up com o perfil da conta ligada
 * àquela linha do WhatsApp, sem sair da aba. O link no rodapé leva à mesa de
 * alunos, que tem o calendário e os relatórios completos.
 */
export function PerfilPopup({ p, rotulo = 'sim' }: { p: PerfilResumo; rotulo?: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" className="chip chip-on" onClick={() => setOpen(true)} title={`ver o perfil de ${p.nome}`}>{rotulo}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="card w-full max-w-[440px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xl font-bold text-white">
                {p.nome.trim().charAt(0).toUpperCase()}
                {p.premium && <span className="absolute -right-2 -top-3 rotate-[20deg] text-lg">👑</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-extrabold">{p.nome}</div>
                <div className="truncate text-xs text-fg2">{p.user ? `@${p.user}` : ''}{p.user && p.email ? ' · ' : ''}{p.email ?? ''}</div>
                <span className="mt-1 inline-block rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold text-white" style={{ background: p.grupoCor }}>{p.grupoTag}</span>
              </div>
              <button type="button" className="chip" onClick={() => setOpen(false)} aria-label="fechar">✕</button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div><div className="font-display text-xl font-extrabold leading-none">{p.diasAt}</div><div className="kicker">dias ativos (14d)</div></div>
              <div><div className="font-display text-xl font-extrabold leading-none">{p.ab}</div><div className="kicker">aberturas (14d)</div></div>
              <div><div className="font-display text-xl font-extrabold leading-none">{p.pontos.toLocaleString('pt-BR')}</div><div className="kicker">pontos</div></div>
            </div>

            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="kicker">Conta desde</dt><dd>{dt(p.criado)}</dd>
              <dt className="kicker">Última abertura</dt><dd>{p.ultAb ? dt(p.ultAb) : 'nunca abriu'}</dd>
              <dt className="kicker">Plano</dt><dd>{p.premium ? '👑 Premium' : 'Free'}</dd>
              <dt className="kicker">Vestibular</dt><dd>{p.exame ?? '—'}{p.curso ? ` · ${p.curso}` : ''}</dd>
              <dt className="kicker">Idade</dt><dd>{p.idade ?? '—'}{p.tipoEscola ? ` · escola ${p.tipoEscola}` : ''}</dd>
              <dt className="kicker">IA (14d)</dt><dd>{p.ia} chamadas</dd>
              <dt className="kicker">Escola</dt><dd>{p.escola ?? '—'}{p.ano ? ` · ${p.ano}` : ''}</dd>
              <dt className="kicker">Chegou por</dt><dd>{p.canal ?? '—'}{p.cidade ? ` · ${p.cidade}` : ''}</dd>
              {p.contato && <><dt className="kicker">WhatsApp</dt><dd>{p.contato}</dd></>}
              {p.obs && <><dt className="kicker">Observação</dt><dd className="text-fg2">{p.obs}</dd></>}
            </dl>

            <div className="mt-4 flex justify-end gap-2">
              <Link href={`/alunos?u=${p.id}`} className="clay px-3 py-1.5 text-xs">Abrir na mesa de alunos →</Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
