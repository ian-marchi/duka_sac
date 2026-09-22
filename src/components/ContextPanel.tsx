import type { Ticket } from '@/lib/types'
import { deviceLine } from '@/lib/format'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-bg/50 p-3">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-muted">{k}</span>
      <span className="min-w-0 break-words font-mono text-xs">{v}</span>
    </div>
  )
}

/**
 * Perguntas do questionário do beta (lib/betaFeedback.ts do app, rodada
 * beta-1.0). Notas de 1 a 5; 5 = bom. Se a rodada mudar, o id continua q1…qN
 * e o texto novo entra aqui.
 */
const PERGUNTAS_BETA: Record<string, string> = {
  q1: 'Funcionou sem travar ou fechar sozinho?',
  q2: 'A velocidade agradou?',
  q3: 'Foi fácil encontrar o que queria?',
  q4: 'Questões e explicações úteis?',
  q5: 'O Duka respondeu bem?',
  q6: 'Trilha e plano fizeram sentido?',
  q7: 'Recomendaria pra um amigo?',
}

/** Notas da pesquisa do beta que viram ticket (migration 085). */
function PesquisaBeta({ respostas, versao }: { respostas: Record<string, unknown>; versao?: string }) {
  const notas = Object.entries(respostas)
    .map(([k, v]) => ({ k, v: Number(v) }))
    .filter((x) => Number.isFinite(x.v))
    .sort((a, b) => a.k.localeCompare(b.k, undefined, { numeric: true }))
  if (!notas.length) return null
  const media = notas.reduce((s, x) => s + x.v, 0) / notas.length
  const cor = (v: number) => (v >= 4 ? 'rgb(var(--ok))' : v === 3 ? 'rgb(var(--p2))' : 'rgb(var(--p0))')
  return (
    <Panel title={`Pesquisa do beta${versao ? ` · ${versao}` : ''}`}>
      <div className="mb-1 text-xs text-muted">média <b className="text-fg">{media.toFixed(1).replace('.', ',')}</b> de 5 · as notas baixas dizem onde ajudar</div>
      {notas.map(({ k, v }) => (
        <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
          <span className="truncate text-fg/80" title={PERGUNTAS_BETA[k] ?? k}>{PERGUNTAS_BETA[k] ?? k}</span>
          <span className="flex items-center gap-1" title={`${v} de 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} className="block h-2 w-2 rounded-full" style={{ background: i <= v ? cor(v) : 'rgb(var(--border))' }} />
            ))}
            <span className="ml-1 w-3 text-right font-display font-bold">{v}</span>
          </span>
        </div>
      ))}
    </Panel>
  )
}

export function ContextPanel({ t }: { t: Ticket }) {
  const ctx = t.context ?? {}
  const respostas = ctx.respostas && typeof ctx.respostas === 'object' ? (ctx.respostas as Record<string, unknown>) : null
  // O que sobra do contexto depois de tirar o que já tem painel próprio.
  const ctxResto = Object.fromEntries(Object.entries(ctx).filter(([k]) => !['respostas', 'beta_feedback_id', 'versao', 'origem'].includes(k)))
  return (
    <div className="space-y-3">
      {respostas && <PesquisaBeta respostas={respostas} versao={typeof ctx.versao === 'string' ? ctx.versao : undefined} />}

      <Panel title="Onde">
        <Row k="Aparelho" v={deviceLine(t) || t.platform} />
        <Row k="App" v={t.app_version ? `v${t.app_version}${t.build ? ` (build ${t.build})` : ''}` : null} />
        <Row k="Runtime" v={t.runtime_version} />
        <Row k="Tela" v={t.route} />
        <Row k="Locale" v={t.locale} />
      </Panel>

      {t.error_stack && (
        <Panel title="Stack trace">
          {t.error_message && <div className="mb-1 font-mono text-xs text-p0">{t.error_message}</div>}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg p-2 font-mono text-[11px] leading-relaxed text-muted">
            {t.error_stack}
          </pre>
          {t.sentry_event_id && (
            <a
              className="mt-1 inline-block text-xs text-brand underline"
              href={`https://sentry.io/organizations/_/issues/?query=${t.sentry_event_id}`}
              target="_blank" rel="noreferrer"
            >
              ver no Sentry ({t.sentry_event_id})
            </a>
          )}
        </Panel>
      )}

      {Object.keys(ctxResto).length > 0 && (
        <Panel title="Contexto">
          {Object.entries(ctxResto).map(([k, v]) => (
            <Row key={k} k={k} v={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
          ))}
        </Panel>
      )}

      {t.priority_reason?.length > 0 && (
        <Panel title={`Por que ${t.priority}`}>
          {t.priority_reason.map((r) => (
            <div key={r} className="text-xs text-muted">✓ <span className="font-mono">{r}</span></div>
          ))}
          {t.priority_source === 'manual' && (
            <div className="text-xs text-p1">ajustado manualmente — motor automático desligado</div>
          )}
        </Panel>
      )}
    </div>
  )
}
