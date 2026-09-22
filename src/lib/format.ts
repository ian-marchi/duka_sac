// Helpers de formatação em PT-BR — sem dependências externas.

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 7) return `${d} dias`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w} sem`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} mês${mo > 1 ? 'es' : ''}`
  return `${Math.floor(d / 365)} ano(s)`
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/** "Xiaomi Redmi Note 12 · Android 14" a partir dos campos do ticket. */
export function deviceLine(p: {
  device_model: string | null; platform: string | null; os_version: string | null
}): string {
  const os = p.platform === 'ios' ? 'iOS' : p.platform === 'android' ? 'Android' : p.platform ?? ''
  return [p.device_model, [os, p.os_version].filter(Boolean).join(' ')]
    .filter(Boolean).join(' · ')
}

export function pluralPessoas(n: number): string {
  return n === 1 ? '1 pessoa' : `${n} pessoas`
}

/** 1234 → "1,2 mil", 3400000 → "3,4 mi". Bom para contagem de tokens. */
export function compactNumber(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} mil`
  return String(n)
}

export function fullNumber(n: number): string {
  return n.toLocaleString('pt-BR')
}
