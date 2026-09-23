import Link from 'next/link'
import type { Priority, TicketKind, TicketStatus } from '@/lib/types'
import { KIND_META } from '@/lib/types'
import { PriorityTag } from '@/components/PriorityTag'
import { StatusPill } from '@/components/StatusPill'
import { timeAgo } from '@/lib/format'
import { CountUp } from './base'

// Blocos da visão geral que não precisam de estado: últimos tickets e top 5.
// As animações são só CSS (dk-*), então ficam como componentes de servidor.

export type TicketCurto = {
  id: number; ref: string; apelido: string | null; title: string; message: string
  kind: TicketKind; status: TicketStatus; priority: Priority; created_at: string; reporter_name: string | null
}
export type FilaResumo = { key: string; label: string; n: number; cor: string }[]

export function UltimosTickets({ tickets, fila }: { tickets: TicketCurto[]; fila: FilaResumo }) {
  const tot = fila.reduce((s, f) => s + f.n, 0)
  return (
    <section className="dk-tile flex flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="dk-h">Últimos tickets</h2>
          <p className="kicker">{tot} em aberto na fila</p>
        </div>
        <Link href="/tickets" className="chip">abrir a mesa →</Link>
      </div>

      {/* barra empilhada da fila (novos / abertos / aguardando) */}
      <div className="mb-1 flex h-2.5 overflow-hidden rounded-full bg-elev">
        {fila.map((f, i) => f.n > 0 && (
          <div key={f.key} className="dk-grow-x h-full" title={`${f.label}: ${f.n}`}
            style={{ width: `${tot ? (f.n / tot) * 100 : 0}%`, background: f.cor, ['--d' as string]: `${i * 150}ms` }} />
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-muted">
        {fila.map((f) => (
          <span key={f.key} className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: f.cor }} />{f.label} <b className="text-fg2">{f.n}</b>
          </span>
        ))}
      </div>

      <div className="-mx-1 flex-1 space-y-0.5">
        {tickets.length === 0 && <p className="py-6 text-center text-xs text-muted">Nenhum ticket ainda. 🎉</p>}
        {tickets.map((t, i) => (
          <Link key={t.id} href={`/tickets?t=${t.id}`}
            className="dk-fade-up flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition hover:bg-elev"
            style={{ ['--d' as string]: `${i * 60}ms` }}>
            <PriorityTag priority={t.priority} />
            <span className="text-base leading-none" title={KIND_META[t.kind]?.label}>{KIND_META[t.kind]?.icon ?? '🎫'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold">{t.apelido || t.title || t.message || KIND_META[t.kind]?.label}</div>
              <div className="truncate text-[11px] text-muted">
                <span className="font-mono">{t.ref}</span> · {t.reporter_name?.split(' ')[0] ?? 'anônimo'} · {timeAgo(t.created_at)}
              </div>
            </div>
            <StatusPill status={t.status} />
          </Link>
        ))}
      </div>
    </section>
  )
}

export type Lider = { id: string; nome: string; user: string | null; pontos: number; ofensiva: number; avatar: string | null }

const MEDALHA = ['🥇', '🥈', '🥉']
const COR_PODIO = ['rgb(250 204 21)', 'rgb(203 213 225)', 'rgb(217 119 6)']

function Avatar({ l, size }: { l: Lider; size: number }) {
  return l.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={l.avatar} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center rounded-full bg-brand font-display font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {l.nome.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function Top5({ lideres }: { lideres: Lider[] }) {
  const max = Math.max(1, ...lideres.map((l) => l.pontos))
  const podio = [lideres[1], lideres[0], lideres[2]].filter(Boolean) as Lider[]
  const altura = (l: Lider) => 40 + (l.pontos / max) * 60
  return (
    <section className="dk-tile flex flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="dk-h">Top 5 do ranking</h2>
          <p className="kicker">pontos acumulados (users.total_points)</p>
        </div>
        <Link href="/ranking" className="chip">ranking →</Link>
      </div>

      {lideres.length === 0 ? <p className="py-6 text-center text-xs text-muted">Sem pontos ainda.</p> : (
        <>
          <div className="flex items-end justify-center gap-2 pt-2" style={{ height: 170 }}>
            {podio.map((l) => {
              const pos = lideres.indexOf(l)
              return (
                <Link key={l.id} href={`/alunos?u=${l.id}`} className="group flex w-[30%] flex-col items-center">
                  <div className="dk-pop mb-1 flex flex-col items-center" style={{ ['--d' as string]: `${400 + pos * 150}ms` }}>
                    <div className="relative">
                      <Avatar l={l} size={pos === 0 ? 44 : 36} />
                      <span className="absolute -right-1.5 -top-1.5 text-sm">{MEDALHA[pos]}</span>
                    </div>
                    <span className="mt-1 max-w-full truncate text-[11px] font-bold group-hover:text-brandText">{l.nome.split(' ')[0]}</span>
                  </div>
                  <div className="dk-grow-y flex w-full items-start justify-center rounded-t-xl pt-1.5"
                    style={{ height: altura(l), background: `linear-gradient(180deg, ${COR_PODIO[pos]}, rgb(var(--elev)))`, ['--d' as string]: `${pos * 150}ms` }}>
                    <span className="font-display text-sm font-extrabold text-bg"><CountUp value={l.pontos} fmt="compact" /></span>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="mt-2 space-y-1">
            {lideres.slice(3).map((l, i) => (
              <Link key={l.id} href={`/alunos?u=${l.id}`} className="dk-fade-up flex items-center gap-2 rounded-xl px-1.5 py-1 text-xs hover:bg-elev" style={{ ['--d' as string]: `${800 + i * 80}ms` }}>
                <span className="w-4 text-center font-display font-bold text-muted">{i + 4}</span>
                <Avatar l={l} size={24} />
                <span className="min-w-0 flex-1 truncate font-bold">{l.nome}</span>
                <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-elev sm:block">
                  <div className="dk-grow-x h-full rounded-full bg-brand" style={{ width: `${(l.pontos / max) * 100}%` }} />
                </div>
                <span className="w-12 text-right font-display font-bold">{l.pontos.toLocaleString('pt-BR')}</span>
              </Link>
            ))}
          </div>
          <div className="mt-auto pt-2 text-[11px] text-muted">
            🔥 maior ofensiva do top 5: <b className="text-fg2">{Math.max(...lideres.map((l) => l.ofensiva))} dias</b>
          </div>
        </>
      )}
    </section>
  )
}
