import Link from 'next/link'
import type { Ticket } from '@/lib/types'
import { PriorityTag } from './PriorityTag'
import { KindBadge } from './KindBadge'
import { timeAgo, deviceLine, pluralPessoas } from '@/lib/format'

export function TicketRow({ t }: { t: Ticket }) {
  const auto = ['crash', 'api_error', 'media_error', 'performance'].includes(t.source)
  const grouped = t.affected_users > 1
  return (
    <Link
      href={`/t/${t.id}`}
      className={`flex items-start gap-3 border-b px-4 py-3 transition hover:bg-bg
                  ${auto ? 'border-l-2 border-l-dashed border-l-border' : 'border-l-2 border-l-brand/40'}`}
    >
      <div className="mt-0.5 shrink-0">
        <PriorityTag priority={t.priority} reasons={t.priority_reason} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{t.ref}</span>
          <KindBadge kind={t.kind} />
          {t.was_premium && <span className="text-xs" title="usuário premium">⭐</span>}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium">
          {t.apelido || t.title || t.message || '(sem título)'}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {grouped ? (
            <span className="font-medium text-fg/80">
              👥 afeta {pluralPessoas(t.affected_users)} · {t.occurrences} ocorrências
            </span>
          ) : (
            <span>{t.reporter_name ?? t.reporter_email ?? 'anônimo'}</span>
          )}
          {' · '}
          {deviceLine(t) || t.platform || '—'}
          {t.app_version ? ` · v${t.app_version}` : ''}
        </div>
      </div>
      <div className="shrink-0 whitespace-nowrap text-xs text-muted">{timeAgo(t.last_seen_at)}</div>
    </Link>
  )
}
