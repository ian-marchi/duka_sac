'use client'

import { useRef, useState, useTransition } from 'react'
import type { Report, ReportKind } from '@/lib/types'
import { REPORT_KIND_META } from '@/lib/types'
import { fullDate, timeAgo } from '@/lib/format'
import { generateReport, speakReport, syncPending } from '@/app/(painel)/relatorios/actions'

const KINDS: ReportKind[] = ['diario', 'usuarios', 'erros', 'tickets']

export function ReportsPanel({ reports, voiceOnline, vaultOk, pendingSync, morning }: {
  reports: Report[]
  voiceOnline: boolean
  vaultOk: boolean
  pendingSync: number
  /** resumo diário de hoje ainda não ouvido, se houver */
  morning: Report | null
}) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(reports[0]?.id ?? null)
  const [playing, setPlaying] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function gerar(kind: ReportKind) {
    setBusy(kind); setMsg(null)
    start(async () => {
      const r = await generateReport(kind)
      setBusy(null)
      if (!r.ok) setMsg(r.error)
      else { setOpen(r.data!.id); setMsg(`${REPORT_KIND_META[kind].label} gerado ✓`) }
    })
  }

  function ouvir(id: number) {
    setBusy(`voz-${id}`); setMsg(null)
    start(async () => {
      const r = await speakReport(id)
      setBusy(null)
      if (!r.ok) { setMsg(r.error); return }
      const el = audioRef.current
      if (!el) return
      el.src = r.data!.url
      setPlaying(id)
      el.play().catch(() => setMsg('O navegador bloqueou o áudio — clique em ▶ no player.'))
    })
  }

  function sincronizar() {
    setBusy('sync'); setMsg(null)
    start(async () => {
      const r = await syncPending()
      setBusy(null)
      setMsg(r.ok ? `${r.data!.count} nota(s) escritas no Obsidian ✓` : r.error)
    })
  }

  return (
    <div className="space-y-4">
      {/* bom dia */}
      {morning && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-4">
          <div>
            <div className="text-sm font-semibold">🌅 Bom dia. O resumo de hoje está pronto.</div>
            <div className="text-xs text-muted">{morning.title}</div>
          </div>
          <button
            disabled={pending || !voiceOnline}
            onClick={() => ouvir(morning.id)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            title={voiceOnline ? '' : 'JARVIS Voice desligado'}
          >
            {busy === `voz-${morning.id}` ? 'Gerando voz…' : '🔊 Ouvir resumo'}
          </button>
        </div>
      )}

      {/* barra de status + ações */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-3 text-xs">
        <Dot ok={voiceOnline} label={voiceOnline ? 'JARVIS Voice online' : 'JARVIS Voice desligado — rode jarvis-voice\\start.ps1'} />
        <Dot ok={vaultOk} label={vaultOk ? 'Obsidian: vault conectada' : 'OBSIDIAN_VAULT não configurada'} />
        {pendingSync > 0 && (
          <button disabled={pending} onClick={sincronizar} className="rounded-lg border px-2 py-1 hover:bg-bg disabled:opacity-50">
            {busy === 'sync' ? 'Sincronizando…' : `Sincronizar ${pendingSync} pendente(s) com o Obsidian`}
          </button>
        )}
        <span className="ml-auto flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <button
              key={k}
              disabled={pending}
              onClick={() => gerar(k)}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === k ? 'Escrevendo…' : `${REPORT_KIND_META[k].icon} Gerar ${REPORT_KIND_META[k].label.toLowerCase()}`}
            </button>
          ))}
        </span>
      </div>
      {msg && <p className="text-xs text-p1">{msg}</p>}

      <audio ref={audioRef} controls className="w-full" onEnded={() => setPlaying(null)} />

      {/* lista */}
      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted">
          Nenhum relatório ainda. Gere o primeiro acima.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const meta = REPORT_KIND_META[r.kind]
            const isOpen = open === r.id
            return (
              <div key={r.id} className={`rounded-2xl border bg-surface ${playing === r.id ? 'ring-2 ring-brand/40' : ''}`}>
                <button onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-start gap-3 p-4 text-left">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="block text-xs text-muted">
                      {meta.label} · {timeAgo(r.created_at)} · {r.generated_by}
                      {r.cost_usd != null ? ` · US$ ${Number(r.cost_usd).toFixed(4)}` : ''}
                      {r.synced_at ? ' · 📓' : ' · não sincronizado'}
                      {r.spoken_at ? ' · 🔊' : ''}
                    </span>
                  </span>
                  <span className="text-xs text-muted">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="border-t p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        disabled={pending || !voiceOnline}
                        onClick={() => ouvir(r.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-bg disabled:opacity-50"
                      >
                        {busy === `voz-${r.id}` ? 'Gerando voz…' : '🔊 Ouvir resumo'}
                      </button>
                      <span className="text-xs text-muted">{fullDate(r.created_at)} · {r.tokens ?? 0} tokens · {r.model ?? ''}</span>
                    </div>
                    <blockquote className="mb-4 rounded-xl border-l-4 border-brand bg-bg/50 p-3 text-sm italic">
                      {r.summary}
                    </blockquote>
                    <Markdown md={r.body_md} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-p0'}`} />
      <span className="text-muted">{label}</span>
    </span>
  )
}

/** Renderização mínima de markdown (títulos, listas, negrito). O Obsidian renderiza o resto. */
function Markdown({ md }: { md: string }) {
  const lines = md.split('\n')
  const out: React.ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(<ul key={`ul-${out.length}`} className="mb-3 ml-5 list-disc space-y-1">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>)
      list = []
    }
  }
  lines.forEach((raw, i) => {
    const l = raw.trimEnd()
    if (/^\s*[-*]\s+/.test(l)) { list.push(l.replace(/^\s*[-*]\s+/, '')); return }
    flush()
    if (/^#\s/.test(l)) out.push(<h2 key={i} className="mb-2 mt-1 text-base font-bold">{inline(l.replace(/^#\s+/, ''))}</h2>)
    else if (/^##\s/.test(l)) out.push(<h3 key={i} className="mb-1.5 mt-4 text-sm font-semibold uppercase tracking-wide text-muted">{inline(l.replace(/^##\s+/, ''))}</h3>)
    else if (/^###\s/.test(l)) out.push(<h4 key={i} className="mb-1 mt-3 text-sm font-semibold">{inline(l.replace(/^###\s+/, ''))}</h4>)
    else if (l.trim()) out.push(<p key={i} className="mb-2 text-sm leading-relaxed">{inline(l)}</p>)
  })
  flush()
  return <div>{out}</div>
}

function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded bg-bg px-1 font-mono text-xs">{p.slice(1, -1)}</code>
    return p
  })
}
