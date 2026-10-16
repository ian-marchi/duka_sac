'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarEscola } from '@/app/(painel)/escolas/actions'

export function NovaEscola() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <form
      className="card space-y-2 self-start p-4"
      onSubmit={(ev) => {
        ev.preventDefault()
        const form = new FormData(ev.currentTarget)
        const el = ev.currentTarget
        start(async () => {
          const r = await criarEscola(form)
          setMsg(r.ok ? 'Escola cadastrada.' : r.erro ?? 'não deu')
          if (r.ok) { el.reset(); router.refresh() }
        })
      }}
    >
      <h3 className="card-h">Nova escola</h3>
      <input name="nome" required placeholder="Nome da escola *" className="input w-full" />
      <div className="grid grid-cols-[1fr_64px] gap-2">
        <input name="cidade" placeholder="Cidade" className="input w-full" />
        <input name="uf" placeholder="UF" maxLength={2} className="input w-full uppercase" />
      </div>
      <input name="contato_nome" placeholder="Contato (diretor, coordenação)" className="input w-full" />
      <input name="contato_telefone" placeholder="Telefone do contato" className="input w-full" />
      <input name="contato_email" placeholder="E-mail do contato" type="email" className="input w-full" />
      <label className="block text-[11px] text-muted">Premium até <span className="text-fg2">(vazio = enquanto a escola estiver ativa)</span>
        <input name="premium_ate" type="date" className="input mt-1 w-full" />
      </label>
      <textarea name="obs" placeholder="Observações (valor, quem paga, combinado)" rows={2} className="input w-full" />
      <button type="submit" disabled={pending} className="clay w-full px-3 py-1.5 text-[12px]">{pending ? 'Salvando…' : 'Cadastrar escola'}</button>
      {msg && <p className="text-[11px] text-fg2">{msg}</p>}
    </form>
  )
}
