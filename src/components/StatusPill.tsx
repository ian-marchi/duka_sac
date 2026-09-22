import type { TicketStatus } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'

const STYLE: Record<TicketStatus, string> = {
  new:          'bg-brand/15 text-brand',
  triage:       'bg-p2/15 text-p2',
  open:         'bg-p1/15 text-p1',
  waiting_user: 'bg-muted/15 text-muted',
  resolved:     'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  wont_fix:     'bg-muted/15 text-muted',
  duplicate:    'bg-muted/15 text-muted',
  archived:     'bg-muted/10 text-muted',
}

export function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
