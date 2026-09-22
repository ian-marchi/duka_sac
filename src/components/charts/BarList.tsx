// Lista de barras horizontais — sem dependências de chart.

export function BarList({ data, format }: {
  data: { label: string; value: number; hint?: string }[]
  format?: (v: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length) return <div className="py-6 text-center text-xs text-muted">Sem dados ainda.</div>
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-muted" title={d.hint ?? d.label}>{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-bg">
            <div className="h-full rounded bg-brand/70" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right font-mono">{format ? format(d.value) : d.value}</span>
        </div>
      ))}
    </div>
  )
}
