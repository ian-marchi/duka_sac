'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Ticket, TicketKind, Priority } from '@/lib/types'
import { STATUS_GROUPS, KIND_META } from '@/lib/types'
import { TicketRow } from './TicketRow'

const PAGE = 50
const SELECT =
  'id, ref, kind, source, status, priority, priority_source, priority_reason, ' +
  'title, message, reporter_name, reporter_email, was_premium, occurrences, ' +
  'affected_users, platform, os_version, app_version, device_model, ' +
  'last_seen_at, created_at'

export function Fila() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [group, setGroup] = useState('novos')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [kind, setKind] = useState<TicketKind | ''>('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [done, setDone] = useState(false)
  const pageRef = useRef(0)

  const load = useCallback(async (reset: boolean) => {
    setLoading(true)
    const p = reset ? 0 : pageRef.current
    const statuses = STATUS_GROUPS.find((g) => g.key === group)?.statuses ?? []

    let query = supabase.from('tickets').select(SELECT) as any
    if (statuses.length) query = query.in('status', statuses)
    if (priority) query = query.eq('priority', priority)
    if (kind) query = query.eq('kind', kind)
    if (q.trim()) query = query.or(`title.ilike.%${q}%,message.ilike.%${q}%,ref.ilike.%${q}%`)

    query = query
      .order('priority', { ascending: true })
      .order('last_seen_at', { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1)

    const { data, error } = await query
    setLoading(false)
    if (error) { console.error(error); return }
    const list = (data ?? []) as Ticket[]
    setDone(list.length < PAGE)
    setRows((prev) => (reset ? list : [...prev, ...list]))
  }, [supabase, group, priority, kind, q])

  // recarrega quando um filtro muda
  useEffect(() => {
    pageRef.current = 0
    setPage(0)
    void load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, priority, kind])

  // busca com debounce
  useEffect(() => {
    const t = setTimeout(() => { pageRef.current = 0; setPage(0); void load(true) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // realtime: prepend em insert, substitui em update
  useEffect(() => {
    const ch = supabase
      .channel('fila')
      .on('postgres_changes', { event: '*', schema: 'support', table: 'tickets' }, (payload) => {
        const row = payload.new as Ticket
        if (!row?.id) return
        setRows((prev) => {
          const without = prev.filter((r) => r.id !== row.id)
          if (payload.eventType === 'DELETE') return without
          return [row, ...without]
        })
        if (payload.eventType === 'INSERT' && row.priority === 'P0') {
          document.title = '🔴 Duka · Tickets'
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  function next() {
    pageRef.current += 1
    setPage(pageRef.current)
    void load(false)
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b bg-surface/80 px-4 py-3 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center gap-1">
          {STATUS_GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGroup(g.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                group === g.key ? 'bg-brand text-white' : 'text-muted hover:bg-bg'
              }`}
            >
              {g.label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="ml-auto w-48 rounded-lg border bg-bg px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority | '')}
            className="rounded-lg border bg-bg px-2 py-1 text-sm outline-none"
          >
            <option value="">Prioridade</option>
            <option value="P0">P0 · Crítico</option>
            <option value="P1">P1 · Alto</option>
            <option value="P2">P2 · Médio</option>
            <option value="P3">P3 · Baixo</option>
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TicketKind | '')}
            className="rounded-lg border bg-bg px-2 py-1 text-sm outline-none"
          >
            <option value="">Tipo</option>
            {(Object.keys(KIND_META) as TicketKind[]).map((k) => (
              <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>
            ))}
          </select>
        </div>
      </header>

      <div>
        {rows.map((t) => <TicketRow key={t.id} t={t} />)}
        {loading && <div className="p-6 text-center text-sm text-muted">Carregando…</div>}
        {!loading && rows.length === 0 && (
          <div className="p-12 text-center text-sm text-muted">Nenhum ticket aqui. 🎉</div>
        )}
        {!loading && !done && rows.length > 0 && (
          <div className="p-4 text-center">
            <button onClick={next} className="text-sm text-brand underline">Carregar mais</button>
          </div>
        )}
      </div>
    </div>
  )
}
