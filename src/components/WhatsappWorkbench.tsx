import Link from 'next/link'
import { STATUS_META, escolaCurta, semAcento, type Aluno, type ResumoAlunos, type ScanRun } from '@/lib/alunos'
import { ScanAlunos } from '@/components/ScanAlunos'
import { PerfilPopup, type PerfilResumo } from '@/components/PerfilPopup'

/* ── peças ─────────────────────────────────────────────────────────────────── */

function Card({ icon, title, tag, children, grow }: { icon: string; title: string; tag?: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={`card p-3.5 ${grow ? 'flex-1' : ''}`}>
      <h3 className="card-h flex items-center gap-2">
        <span>{icon}</span>{title}
        {tag && <span className="ml-auto rounded-full border border-brand bg-brandSoft px-2 text-[10px] font-bold text-brandText">{tag}</span>}
      </h3>
      {children}
    </div>
  )
}
const Kpi = ({ n, label, cor }: { n: number; label: string; cor?: string }) => (
  <div><div className="font-display text-xl font-extrabold leading-none" style={cor ? { color: cor } : undefined}>{n}</div><div className="kicker">{label}</div></div>
)
const StatusPill = ({ s }: { s: Aluno['status'] }) => (
  <span className="rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold text-white" style={{ background: STATUS_META[s].cor }}>{STATUS_META[s].label.replace(' (conversa vazia)', '')}</span>
)

/* ── filtro (compartilhado entre página e lista) ──────────────────────────── */

export const FILTROS_WS: { key: string; label: string }[] = [
  { key: 'todos', label: 'Todos' }, { key: 'respondeu', label: 'Responderam' }, { key: 'nao', label: 'Não responderam' },
  { key: 'conta', label: 'Já no app' }, { key: 'semconta', label: 'Ainda sem conta' }, { key: 'prof', label: 'Professores' },
]

export function filtrarWhatsapp(ws: ResumoAlunos, f: string, nq: string): Aluno[] {
  let lista = ws.alunos.filter((a) => {
    if (f === 'respondeu') return a.status === 'respondeu'
    if (f === 'nao') return a.status !== 'respondeu'
    if (f === 'conta') return !!a.conta
    if (f === 'semconta') return !a.conta && !!a.nome
    if (f === 'prof') return a.professor
    if (f.startsWith('escola:')) { const e = ws.porEscola.find((x) => x.slug === f.slice(7)); return !!e && a.escola === e.escola }
    return true
  })
  if (nq) lista = lista.filter((a) => semAcento(`${a.nome} ${a.contato} ${a.telefone} ${a.escola} ${a.ano} ${a.obs}`).includes(nq))
  return lista.sort((x, y) => (x.nome ? 0 : 1) - (y.nome ? 0 : 1) || x.nome.localeCompare(y.nome, 'pt-BR'))
}

/* ── coluna 1: resumo ──────────────────────────────────────────────────────── */

export function WhatsappResumo({ ws, scan, f }: { ws: ResumoAlunos; scan: { ultimo: ScanRun | null; aberto: ScanRun | null }; f: string }) {
  const maxEsc = Math.max(1, ...ws.porEscola.map((e) => e.total))
  const maxAno = Math.max(1, ...ws.anos.map((a) => a.value))
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto border-r bg-surface/40 px-3 py-3.5">
      <div className="flex items-center gap-2">
        <div className="font-display text-base font-extrabold">WhatsApp</div>
        <span className="text-xs text-fg2">quem chegou pelo WhatsApp do Duka</span>
      </div>

      <Card icon="💬" title="Scan" tag="planilha">
        <ScanAlunos ultimo={scan.ultimo} aberto={scan.aberto} atualizadoEm={ws.atualizadoEm} total={ws.total} />
      </Card>

      <Card icon="📊" title="Números" tag="métrica">
        <div className="grid grid-cols-3 gap-2">
          <Kpi n={ws.total} label="abordados" />
          <Kpi n={ws.responderam} label="responderam" cor="rgb(14 148 105)" />
          <Kpi n={ws.comConta} label="já no app" cor="rgb(var(--brand))" />
          <Kpi n={ws.naoResponderam} label="não responderam" cor="rgb(217 119 6)" />
          <Kpi n={ws.semDados} label="sem dados" />
          <Kpi n={ws.professores} label="professores" />
        </div>
        <div className="kicker mt-2">{ws.responderam ? Math.round((ws.comConta / ws.responderam) * 100) : 0}% de quem respondeu já criou conta no app</div>
      </Card>

      <Card icon="🏫" title="Por escola" tag="origem">
        <div className="space-y-1.5">
          {ws.porEscola.length === 0 && <p className="text-xs text-muted">Nenhum aluno com escola ainda.</p>}
          {ws.porEscola.map((e) => {
            const on = f === `escola:${e.slug}`
            return (
              <Link key={e.slug} href={on ? '/whatsapp' : `/whatsapp?f=escola:${e.slug}`} scroll={false} className={`block rounded-lg px-1 py-0.5 ${on ? 'bg-elev' : 'hover:bg-surface'}`} title={e.escola}>
                <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-[11px]">
                  <span className="truncate font-bold text-fg">{e.curto}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(e.total / maxEsc) * 100}%` }}>
                      <div className="h-full rounded-full bg-ok" style={{ width: `${e.total ? (e.comConta / e.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-fg2"><b className="text-fg">{e.total}</b> · {e.comConta} no app</span>
                </div>
              </Link>
            )
          })}
        </div>
        <div className="kicker mt-2">roxo = chegaram pelo WhatsApp · verde = já têm conta · clique filtra a lista</div>
      </Card>

      <Card icon="🎓" title="Por ano" tag="quem respondeu">
        <div className="space-y-1.5">
          {ws.anos.map((a) => (
            <div key={a.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-[11px]">
              <span className="truncate text-fg2">{a.label}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full" style={{ width: `${(a.value / maxAno) * 100}%`, background: 'rgb(var(--fg2))' }} /></div>
              <span className="text-fg2">{a.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {ws.avisos.length > 0 && (
        <Card icon="⚠️" title="Avisos da planilha" tag={`${ws.avisos.reduce((n, x) => n + x.itens.length, 0)}`} grow>
          <div className="space-y-2 text-[11px]">
            {ws.avisos.map((av) => (
              <details key={av.tipo}>
                <summary className="cursor-pointer font-bold text-fg">{av.tipo} <span className="text-muted">({av.itens.length})</span></summary>
                <ul className="mt-1 space-y-0.5 pl-3 text-fg2">
                  {av.itens.map((i, k) => <li key={k}><b>{i.nome}</b> · {i.contato}{i.obs ? ` — ${i.obs}` : ''}</li>)}
                </ul>
              </details>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ── coluna 2: lista ───────────────────────────────────────────────────────── */

export function WhatsappLista({ ws, alunos, f, q, perfis }: { ws: ResumoAlunos; alunos: Aluno[]; f: string; q: string; perfis: Record<string, PerfilResumo> }) {
  const href = (over: Partial<{ f: string; q: string }>) => {
    const p = new URLSearchParams()
    const ff = over.f ?? f, qq = over.q ?? q
    if (ff && ff !== 'todos') p.set('f', ff)
    if (qq) p.set('q', qq)
    const s = p.toString()
    return `/whatsapp${s ? `?${s}` : ''}`
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b px-3 pb-2.5 pt-3">
        <form method="get" action="/whatsapp" className="flex items-center gap-2">
          {f && f !== 'todos' && <input type="hidden" name="f" value={f} />}
          <input name="q" defaultValue={q} placeholder="Nome, número, escola, observação…" className="input" />
          <span className="whitespace-nowrap text-[11px] text-muted">{alunos.length} de {ws.total}</span>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS_WS.map((x) => <Link key={x.key} href={href({ f: x.key })} className={`chip ${f === x.key ? 'chip-on' : ''}`}>{x.label}</Link>)}
          {ws.porEscola.map((e) => (
            <Link key={e.slug} href={href({ f: `escola:${e.slug}` })} title={`${e.escola} · ${e.total}`} className={`chip ${f === `escola:${e.slug}` ? 'chip-on' : ''}`}>{e.curto}</Link>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {alunos.length === 0 && <div className="p-10 text-center text-sm text-muted">Ninguém com esse filtro.</div>}
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-bg text-left text-[10px] uppercase tracking-wide text-muted">
            <tr><th className="px-3 py-2">Nome</th><th className="px-2 py-2">Escola</th><th className="px-2 py-2">Ano</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">No app</th><th className="px-2 py-2">Observação</th></tr>
          </thead>
          <tbody>
            {alunos.map((a, i) => (
              <tr key={`${a.contato}-${i}`} className="border-t border-borderSubtle hover:bg-surface">
                <td className="px-3 py-1.5">
                  <div className="font-bold text-fg">{a.nome || <span className="font-normal text-muted">(sem nome)</span>}</div>
                  <div className="text-[11px] text-muted">{a.contato}</div>
                </td>
                <td className="px-2 py-1.5 text-fg2" title={a.escolaBruta}>{a.nome ? escolaCurta(a.escola) : '—'}</td>
                <td className="px-2 py-1.5 text-fg2">{a.nome ? a.ano : '—'}</td>
                <td className="px-2 py-1.5"><StatusPill s={a.status} /></td>
                <td className="px-2 py-1.5">
                  {a.conta
                    ? (perfis[a.conta.id]
                        ? <PerfilPopup p={perfis[a.conta.id]} />
                        : <Link href={`/alunos?u=${a.conta.id}`} className="chip chip-on">sim</Link>)
                    : a.nome ? <span className="text-muted">ainda não</span> : <span className="text-muted">—</span>}
                </td>
                <td className="max-w-[26ch] truncate px-2 py-1.5 text-[11px] text-muted" title={a.obs}>{a.obs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
