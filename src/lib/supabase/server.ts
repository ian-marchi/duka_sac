import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Cliente server-side. Padrão no schema `support`. Sessão do admin via cookies.
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: CookieToSet[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {
            // chamado de um Server Component sem resposta mutável — ok, o
            // middleware cuida do refresh do cookie.
          }
        },
      },
      db: { schema: 'support' },
    },
  )
}
