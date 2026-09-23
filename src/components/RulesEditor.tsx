'use client'

import { useState, useTransition } from 'react'
import type { PriorityRule, Priority } from '@/lib/types'
import { KIND_META } from '@/lib/types'
import { toggleRule, updateRule, testText } from '@/app/(painel)/regras/actions'

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']

export function RulesEditor({ rules }: { rules: PriorityRule[] }) {
  const [pending, start] = useTransition()
  const [test, setTest] = useState('')
  const [result, setResult] = useState<{ priority: string; reasons: string[] } | null>(null)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Testar regra</h2>
        <div className="flex gap-2">
          <input
            value={test}
            onChange={(e) => setTest(e.target.value)}
            placeholder="Cole um texto de exemplo…"
            className="flex-1 rounded-lg border bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            disabled={pending || !test.trim()}
            onClick={() => start(async () => setResult(await testText(test)))}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-bg disabled:opacity-50"
          >
            Testar
          </button>
        </div>
        {result && (
          <div className="mt-2 text-sm">
            → <strong>{result.priority}</strong>{' '}
            <span className="text-muted">({result.reasons.join(', ')})</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted">
              <th className="p-2">✓</th>
              <th className="p-2">Regra</th>
              <th className="p-2">→</th>
              <th className="p-2">Tipos</th>
              <th className="p-2">Palavras</th>
              <th className="p-2">Limiares</th>
              <th className="p-2">Peso</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    disabled={pending}
                    onChange={(e) => start(async () => { await toggleRule(r.id, e.target.checked) })}
                  />
                </td>
                <td className="p-2">
                  <div className="font-mono text-xs">{r.id}</div>
                  <div className="max-w-[200px] text-xs text-muted">{r.description}</div>
                </td>
                <td className="p-2">
                  <select
                    defaultValue={r.priority}
                    disabled={pending}
                    onChange={(e) => start(async () => {
                      await updateRule(r.id, { priority: e.target.value as Priority })
                    })}
                    className="rounded border bg-bg px-1 py-0.5 text-xs font-bold"
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="max-w-[140px] p-2 text-xs text-muted">
                  {r.match_kind?.map((k) => KIND_META[k as keyof typeof KIND_META]?.label ?? k).join(', ') ?? '—'}
                </td>
                <td className="max-w-[180px] p-2 text-xs text-muted">
                  {r.match_words?.join(', ') ?? '—'}
                </td>
                <td className="p-2 text-xs text-muted">
                  {r.min_users ? `≥${r.min_users} users` : ''}
                  {r.min_occurs ? ` ≥${r.min_occurs} occ` : ''}
                  {r.premium_only ? ' premium' : ''}
                  {!r.min_users && !r.min_occurs && !r.premium_only ? '—' : ''}
                </td>
                <td className="p-2 font-mono text-xs">{r.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Maior peso vence no desempate. Regras com limiares (usuários/ocorrências)
        não entram no teste de texto acima — só valem quando um ticket real bate os critérios.
      </p>
    </div>
  )
}
