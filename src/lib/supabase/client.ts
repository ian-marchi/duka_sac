'use client'

import { createBrowserClient } from '@supabase/ssr'

// Cliente para componentes client-side (realtime, ações). Padrão no schema
// `support`; para ler public.users use .schema('public') explicitamente.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'support' } },
  )
}
