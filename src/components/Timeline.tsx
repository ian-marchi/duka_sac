import type { TicketEvent } from '@/lib/types'
import { fullDate } from '@/lib/format'

const TYPE_LABEL: Record<string, string> = {
  created: 'criado', status: 'status', priority: 'prioridade',
  reply: 'respondeu', whatsapp: 'WhatsApp', note: 'nota', merge: 'fundiu', duplicate: 'duplicado',
}

export function Timeline({ events }: { events: TicketEvent[] }) {
  if (!events.length) return null
  return (
    <ol className="space-y-2 text-xs">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="w-28 shrink-0 text-muted">{fullDate(e.created_at)}</span>
          <span className="min-w-0">
            <span className="font-medium">{e.actor}</span>{' '}
            <span className="text-muted">{TYPE_LABEL[e.type] ?? e.type}</span>
            {e.from_value && e.to_value && (
              <span className="text-muted"> · {e.from_value} → <strong className="text-fg">{e.to_value}</strong></span>
            )}
            {e.body && <div className="mt-0.5 whitespace-pre-wrap text-muted">{e.body}</div>}
          </span>
        </li>
      ))}
    </ol>
  )
}
