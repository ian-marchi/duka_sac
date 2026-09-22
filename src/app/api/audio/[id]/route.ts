import { promises as fs } from 'node:fs'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { audioAbsPath } from '@/lib/obsidian'

// Serve o WAV do relatório a partir da vault. Só para admin logado.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return new NextResponse('forbidden', { status: 403 })

  const { id } = await ctx.params
  const n = Number(id)
  const p = Number.isFinite(n) ? audioAbsPath(n) : null
  if (!p) return new NextResponse('not found', { status: 404 })

  try {
    const buf = await fs.readFile(p)
    // Uint8Array novo (ArrayBuffer próprio) — Buffer não fecha com BodyInit no @types/node 22.
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=3600' },
    })
  } catch {
    return new NextResponse('not found', { status: 404 })
  }
}
