// Mini gráfico de colunas por dia — sem dependências.

export function Sparkbars({ data }: { data: { day: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length) return <div className="py-6 text-center text-xs text-muted">Sem dados ainda.</div>
  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {data.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.value}`}>
          <div
            className="w-full rounded-t bg-brand/70"
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
          <span className="text-[9px] text-muted">{d.day.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}
