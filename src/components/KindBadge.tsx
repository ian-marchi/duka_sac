import type { TicketKind } from '@/lib/types'
import { KIND_META } from '@/lib/types'

export function KindBadge({ kind }: { kind: TicketKind }) {
  const meta = KIND_META[kind]
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-bg px-1.5 py-0.5 text-xs
                     font-medium text-muted ring-1 ring-inset ring-border">
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  )
}
