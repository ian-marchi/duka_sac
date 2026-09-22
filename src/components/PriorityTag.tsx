import type { Priority } from '@/lib/types'
import { PRIORITY_LABEL } from '@/lib/types'

const STYLE: Record<Priority, string> = {
  P0: 'bg-p0 text-white',
  P1: 'bg-p1 text-white',
  P2: 'bg-p2/15 text-p2 ring-1 ring-inset ring-p2/30',
  P3: 'bg-p3/15 text-p3 ring-1 ring-inset ring-p3/30',
}

export function PriorityTag({ priority, reasons, title }: {
  priority: Priority
  reasons?: string[]
  title?: boolean
}) {
  const tip = reasons?.length
    ? `${priority} porque: ${reasons.join(', ')}`
    : PRIORITY_LABEL[priority]
  return (
    <span
      title={tip}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold ${STYLE[priority]}`}
    >
      {priority}
      {title && <span className="font-medium opacity-80">· {PRIORITY_LABEL[priority]}</span>}
    </span>
  )
}
