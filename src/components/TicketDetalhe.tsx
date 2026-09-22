import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import type { Ticket, TicketEvent, ReplyTemplate } from '@/lib/types'
import { KIND_META } from '@/lib/types'
import { PriorityTag } from '@/components/PriorityTag'
import { StatusPill } from '@/components/StatusPill'
import { KindBadge } from '@/components/KindBadge'
import { ContextPanel } from '@/components/ContextPanel'
import { Timeline } from '@/components/Timeline'
import { TicketActions } from '@/components/TicketActions'
import { ReplyBox } from '@/components/ReplyBox'
import { WhatsappStatus } from '@/components/WhatsappStatus'
import { timeAgo, fullDate } from '@/lib/format'

/**
 * Coluna da direita da mesa de tickets (desenho F): o ticket selecionado por
 * inteiro — cabeçalho com ações, mensagem, resposta, histórico e o contexto do
 * aparelho. É o conteúdo da antiga página /t/[id], que agora só redireciona.
 */
export async function TicketDetalhe({ id }: { id: number }) {
  const supabase = await supabaseServer()
  const { data: raw } = await supabase.from('tickets').select('*').eq('id', id).single()
  if (!raw) {
    return <div className="p-10 text-center text-sm text-muted">Ticket {id} não existe mais.</div>
  }
  const t = raw as Ticket

  const [{ data: events }, { data: templates }, related] = await Promise.all([
    supabase.from('ticket_events').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
    supabase.from('reply_templates').select('*'),
    t.user_id
      ? supabase.from('tickets').select('id, ref, kind, status').eq('user_id', t.user_id).neq('id', id).limit(5)
      : Promise.resolve({ data: [] as { id: number; ref: string }[] }),
  ])
  const { data: profile } = t.user_id
    ? await supabase.schema('public').from('users')
        .select('full_name, username, premium_status, premium_until, total_points, current_streak, created_at')
        .eq('id', t.user_id).single()
    : { data: null }

  const meta = KIND_META[t.kind]
  const others = (related?.data ?? []) as { id: number; ref: string }[]
  const premium = profile && (profile.premium_status === 'premium' || profile.premium_status === 'trial')

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityTag priority={t.priority} reasons={t.priority_reason} title />
            <KindBadge kind={t.kind} />
            <StatusPill status={t.status} />
            <span className="font-mono text-xs text-muted">{t.ref}</span>
          </div>
          <h1 className="mt-1.5 font-display text-lg font-extrabold leading-tight">{t.title || `${meta.icon} ${meta.label}`}</h1>
          <div className="mt-0.5 text-xs text-muted">
            {t.source === 'user' || t.source === 'nps' ? 'manual' : 'automático'} · aberto {timeAgo(t.created_at)} · última atividade {timeAgo(t.last_seen_at)}
            {t.affected_users > 1 && <span className="font-medium text-fg2"> · 👥 afeta {t.affected_users} pessoas · {t.occurrences} ocorrências</span>}
          </div>
        </div>
        <TicketActions id={t.id} status={t.status} priority={t.priority} note={t.internal_note} />
      </div>

      <div className="grid flex-1 gap-4 overflow-auto p-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {t.message && (
            <div className="card">
              <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brandSoft font-display text-[11px] font-bold text-brandText">
                  {(t.reporter_name ?? 'A').trim().charAt(0).toUpperCase()}
                </span>
                <b className="text-fg">{t.reporter_name ?? 'anônimo'}</b> · {timeAgo(t.created_at)}
              </div>
              <p className="whitespace-pre-wrap text-sm">{t.message}</p>
            </div>
          )}
          <section className="card">
            <h2 className="card-h">Responder por e-mail</h2>
            <ReplyBox id={t.id} toEmail={t.reporter_email} ref_={t.ref} kind={t.kind} reporterName={t.reporter_name} templates={(templates ?? []) as ReplyTemplate[]} />
          </section>
          <section className="card">
            <h2 className="card-h">Histórico</h2>
            <Timeline events={(events ?? []) as TicketEvent[]} />
          </section>
        </div>

        <div className="space-y-3">
          <div className="card p-3">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Quem relatou</div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-brand font-display text-xs font-bold text-white">
                {(t.reporter_name ?? profile?.full_name ?? 'A').trim().charAt(0).toUpperCase()}
                {premium && <span className="absolute -right-1.5 -top-2 rotate-[20deg] text-[11px]">👑</span>}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{t.reporter_name ?? profile?.full_name ?? 'anônimo'}</div>
                {profile?.username && <div className="truncate text-xs text-muted">@{profile.username}</div>}
              </div>
            </div>
            {t.reporter_email && <div className="mt-1 text-xs text-muted">{t.reporter_email}</div>}
            {profile && (
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                <div>{premium ? `👑 ${profile.premium_status}` : 'free'}{profile.premium_until ? ` até ${fullDate(profile.premium_until)}` : ''}</div>
                <div>{profile.total_points ?? 0} pts · ofensiva {profile.current_streak ?? 0}</div>
                <div>conta criada {profile.created_at ? timeAgo(profile.created_at) : '—'}</div>
                {t.user_id && <Link href={`/alunos?u=${t.user_id}`} className="text-brandText underline">ver o aluno →</Link>}
              </div>
            )}
            {others.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="text-muted">Outros tickets: </span>
                {others.map((o) => <Link key={o.id} href={`/tickets?t=${o.id}`} scroll={false} className="mr-1 text-brandText underline">{o.ref}</Link>)}
              </div>
            )}
          </div>
          <WhatsappStatus ticketId={t.id} />
          <ContextPanel t={t} />
        </div>
      </div>
    </div>
  )
}
