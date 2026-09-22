'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setLoading(false)
      setError(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message,
      )
      return
    }
    // A sessão já está no cookie; o middleware libera o painel.
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-2xl">🎫</span>
          <div>
            <h1 className="text-lg font-bold">Duka · Tickets</h1>
            <p className="text-xs text-muted">Painel privado de suporte</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">E-mail</label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full rounded-xl border bg-bg px-3 py-2 text-sm outline-none
                         focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Senha</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border bg-bg px-3 py-2 text-sm outline-none
                         focus:border-brand"
            />
          </div>
          {error && <p className="text-xs text-p0">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white
                       transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-center text-xs text-muted">
            Só e-mails autorizados conseguem entrar.
          </p>
        </form>
      </div>
    </main>
  )
}
