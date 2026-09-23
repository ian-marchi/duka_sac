import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { JarvisVoice } from '@/components/JarvisVoice'
import { RailNav } from '@/components/RailNav'

/**
 * Casca do painel (desenho F): trilho de ícones à esquerda, conteúdo ocupando
 * o resto. As páginas de "mesa" (tickets, alunos) travam a altura na tela e
 * rolam por coluna; as outras rolam normalmente.
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return <SemAcesso email={user.email ?? ''} />

  const inicial = (user.email ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-[68px] shrink-0 flex-col items-center gap-2 border-r bg-bg py-3.5">
        <div
          className="mb-2 flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-brand text-lg"
          style={{ borderBottom: '3px solid rgb(var(--brand-dark))' }}
          title="Duka · JARVIS"
        >
          🐘
        </div>
        <RailNav />
        <div className="mt-auto flex flex-col items-center gap-3 pb-1">
          <form action="/auth/signout" method="post" title={`${user.email} · sair`}>
            <button
              type="submit"
              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full bg-brand font-display text-sm font-bold text-white"
              aria-label="Sair"
            >
              {inicial}
            </button>
          </form>
        </div>
      </aside>
      <main className="h-screen min-w-0 flex-1 overflow-auto">{children}</main>
      <JarvisVoice />
    </div>
  )
}

function SemAcesso({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <div className="mb-3 text-3xl">🔒</div>
        <h1 className="mb-2 font-display text-lg font-bold">Sem acesso</h1>
        <p className="text-sm text-muted">
          O e-mail <strong>{email}</strong> não está autorizado neste painel.
          Adicione-o em <code className="text-xs">support.admins</code> pelo Supabase.
        </p>
        <form action="/auth/signout" method="post" className="mt-4">
          <button className="text-sm text-brandText underline" type="submit">
            Entrar com outra conta
          </button>
        </form>
      </div>
    </main>
  )
}
