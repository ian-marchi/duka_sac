'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Ticket, Priority } from '@/lib/types'
import { STATUS_GROUPS, KIND_META } from '@/lib/types'
import { PriorityTag } from './PriorityTag'
import { timeAgo, deviceLine, pluralPessoas } from '@/lib/format'

const PAGE = 50
const SELECT =
  'id, ref, kind, source, status, priority, priority_source, priority_reason, ' +
  'apelido, title, message, reporter_name, was_premium, occurrences, ' +
  'affected_users, platform, os_version, app_version, device_model, ' +
  'last_seen_at, created_at'

/**
 * Coluna do meio da mesa de tickets (desenho F): busca, chips de grupo e a
 * lista. Clicar numa linha só troca o `?t=` da URL — o detalhe abre na coluna
 * da direita, sem sair da tela. Mesma consulta e mesmo realtime da Fila antiga.
 */
export function FilaLista({ selected }: { selected: number | null }) {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [group, setGroup] = useState('abertos')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const pageRef = useRef(0)

  // "Abertos" aqui junta novos + triagem + aberto + aguardando (na Fila antiga
  // 'abertos' era só triagem + aberto, por isso os dois saem da lista base).
  const grupos = useMemo(() => [
    { key: 'abertos', label: 'Abertos', statuses: ['new', 'triage', 'open', 'waiting_user'] },
    ...STATUS_GROUPS.filter((g) => g.key !== 'novos' && g.key !== 'abertos'),
  ], [])

  const load = useCallback(async (reset: boolean) => {
    setLoading(true)
    const p = reset ? 0 : pageRef.current
    const statuses = grupos.find((g) => g.key === group)?.statuses ?? []
    let query = supabase.from('tickets').select(SELECT) as any
    if (statuses.length) query = query.in('status', statuses)
    if (priority) query = query.eq('priority', priority)
    if (q.trim()) query = query.or(`apelido.ilike.%${q}%,title.ilike.%${q}%,message.ilike.%${q}%,ref.ilike.%${q}%`)
    query = query.order('priority', { ascending: true }).order('last_seen_at', { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1)
    const { data, error } = await query
    setLoading(false)
    if (error) { console.error(error); return }
    const list = (data ?? []) as Ticket[]
    setDone(list.length < PAGE)
    setRows((prev) => (reset ? list : [...prev, ...list]))
  }, [supabase, group, priority, q, grupos])

  useEffect(() => { pageRef.current = 0; void load(true) }, [group, priority]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => { pageRef.current = 0; void load(true) }, 350)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ch = supabase.channel('fila-f')
      .on('postgres_changes', { event: '*', schema: 'support', table: 'tickets' }, (payload) => {
        const row = payload.new as Ticket
        if (!row?.id) return
        setRows((prev) => {
          const without = prev.filter((r) => r.id !== row.id)
          return payload.eventType === 'DELETE' ? without : [row, ...without]
        })
        if (payload.eventType === 'INSERT' && row.priority === 'P0') document.title = '🔴 Duka · JARVIS'
      }).subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b px-3 pb-2.5 pt-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ticket…" className="input" />
        <div className="flex flex-wrap gap-1.5">
          {grupos.map((g) => (
            <button key={g.key} onClick={() => setGroup(g.key)} className={`chip ${group === g.key ? 'chip-on' : ''}`}>{g.label}</button>
          ))}
          <button onClick={() => setPriority(priority ? '' : 'P0')} className={`chip ${priority ? 'chip-on' : ''}`} title="Só críticos e altos">
            {priority ? 'P0–P1 ✓' : 'P0–P1'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {rows.map((t) => {
          const on = t.id === selected
          const grouped = t.affected_users > 1
          return (
            <Link
              key={t.id}
              href={`/tickets?t=${t.id}`}
              scroll={false}
              className={`mb-1 flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 transition
                ${on ? 'border-brand border-b-[3px] bg-elev' : 'border-transparent hover:bg-surface'}`}
            >
              <div className="mt-0.5 shrink-0"><PriorityTag priority={t.priority} reasons={t.priority_reason} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold">{t.apelido || t.title || t.message || `${KIND_META[t.kind].icon} ${KIND_META[t.kind].label}`}</div>
                {t.apelido && <div className="truncate text-[11px] text-fg2">{t.title || t.message}</div>}
                <div className="mt-0.5 truncate text-[11px] text-muted">
                  <span className="font-mono">{t.ref}</span>
                  {' · '}{KIND_META[t.kind].label}
                  {grouped ? ` · ${pluralPessoas(t.affected_users)}` : t.platform ? ` · ${deviceLine(t) || t.platform}` : ''}
                  {t.app_version ? ` · v${t.app_version}` : ''}
                  {' · '}{timeAgo(t.last_seen_at)}
                  {t.was_premium && ' · 👑'}
                </div>
              </div>
            </Link>
          )
        })}
        {loading && <div className="p-6 text-center text-xs text-muted">Carregando…</div>}
        {!loading && rows.length === 0 && <div className="p-10 text-center text-sm text-muted">Nenhum ticket aqui. 🎉</div>}
        {!loading && !done && rows.length > 0 && (
          <button onClick={() => { pageRef.current += 1; void load(false) }} className="mx-auto my-3 block text-xs text-brandText underline">Carregar mais</button>
        )}
      </div>
    </div>
  )
}
