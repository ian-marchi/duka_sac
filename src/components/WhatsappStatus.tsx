import { supabaseServer } from '@/lib/supabase/server'
import { timeAgo } from '@/lib/format'
import { RascunhoAcoes } from '@/components/RascunhoAcoes'

type Linha = { id: number; tipo: string; status: string; to_phone: string | null; corpo: string; erro: string | null; criado_em: string; enviado_em: string | null }

const STATUS: Record<string, { label: string; cor: string }> = {
  queued:  { label: 'na fila',   cor: 'rgb(var(--p2))' },
  sent:    { label: 'enviada',   cor: 'rgb(var(--ok))' },
  failed:  { label: 'falhou',    cor: 'rgb(var(--p0))' },
  skipped: { label: 'sem número', cor: 'rgb(var(--muted))' },
  draft:   { label: 'rascunho',  cor: 'rgb(var(--brand))' },
}
const TIPO: Record<string, string> = { recebido: 'Entrou em análise', resolvido: 'Resolvido', manual: 'Resposta' }

/**
 * Mensagens de WhatsApp ligadas a este ticket (support.whatsapp_outbox,
 * migration 088). O banco enfileira; o bot `npm run whatsapp` envia. Aqui só
 * mostra em que pé está cada uma e o texto que foi (ou vai ser) mandado.
 */
export async function WhatsappStatus({ ticketId }: { ticketId: number }) {
  const supabase = await supabaseServer()
  const { data } = await supabase.from('whatsapp_outbox')
    .select('id, tipo, status, to_phone, corpo, erro, criado_em, enviado_em')
    .eq('ticket_id', ticketId).order('id')
  const linhas = (data ?? []) as Linha[]
  if (!linhas.length) return null
  return (
    <div className="rounded-xl border bg-bg/50 p-3">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">WhatsApp</div>
      <div className="space-y-2">
        {linhas.map((l) => {
          const st = STATUS[l.status] ?? { label: l.status, cor: 'rgb(var(--muted))' }
          return (
            <details key={l.id} className="text-xs" open={l.status === 'draft'}>
              <summary className="flex cursor-pointer items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: st.cor }} />
                <span className="font-bold">{TIPO[l.tipo] ?? l.tipo}</span>
                <span className="text-muted">· {st.label}{l.enviado_em ? ` ${timeAgo(l.enviado_em)}` : l.status === 'queued' ? ' (o bot manda ao rodar)' : ''}</span>
                {l.to_phone && <span className="ml-auto font-mono text-muted">+{l.to_phone}</span>}
              </summary>
              <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-bg p-2 text-fg/80">{l.corpo}</p>
              {l.erro && <p className="mt-1 text-p0">{l.erro}</p>}
              {l.status === 'draft' && <RascunhoAcoes outboxId={l.id} />}
            </details>
          )
        })}
      </div>
    </div>
  )
}
