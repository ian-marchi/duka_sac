import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { addDays, hojeSP } from '@/lib/analytics'
import { BarList } from '@/components/charts/BarList'
import { formatarTelefone, telefoneDigitos } from '@/lib/aparelho'

export const dynamic = 'force-dynamic'

/**
 * Downloads Android — o cadastro do APK no site (migration 134).
 *
 * Funil: cliques no botão (support.site_cliques) → cadastro (nome + WhatsApp)
 * → download começou/terminou (servidor do beta) → abriu o app (código da área
 * de transferência) → conta criada (código ou telefone igual). A lista mostra
 * quem parou no meio, com o WhatsApp pra chamar.
 */

type Lead = {
  id: number; codigo: string; nome: string; telefone: string; aparelho: string | null; origem: string | null
  utm: Record<string, string> | null; cadastros: number; criado_em: string
  download_inicio_em: string | null; download_fim_em: string | null; downloads: number
  abriu_app_em: string | null; conta_id: string | null; conta_ligada_por: string | null
  conta_criada_em: string | null; conta_nome: string | null
  etapa: 'cadastrou' | 'baixando' | 'baixou' | 'abriu' | 'conta'
}
type Clique = { dia: string; evento: string; aparelho: string; n: number }

const ETAPA: Record<Lead['etapa'], { label: string; cls: string }> = {
  cadastrou: { label: 'só cadastrou', cls: 'border-border bg-elev text-fg2' },
  baixando:  { label: 'download parou', cls: 'border-p1/50 bg-p1/15 text-p1' },
  baixou:    { label: 'baixou, não abriu', cls: 'border-p1/50 bg-p1/15 text-p1' },
  abriu:     { label: 'abriu, sem conta', cls: 'border-brand/50 bg-brandSoft text-brandText' },
  conta:     { label: 'criou conta', cls: 'border-ok/50 bg-ok/15 text-ok' },
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
const quando = (ts: string) => new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<{ dias?: string; etapa?: string }> }) {
  const sp = await searchParams
  const dias = [7, 30, 90].includes(Number(sp.dias)) ? Number(sp.dias) : 30
  const filtro = sp.etapa && sp.etapa in ETAPA ? (sp.etapa as Lead['etapa']) : null
  const desde = addDays(hojeSP(), -(dias - 1))

  const supabase = await supabaseServer()
  const [{ data: leads, error }, { data: cliques }] = await Promise.all([
    supabase.from('v_leads_apk').select('*').gte('criado_em', `${desde}T03:00:00Z`).order('criado_em', { ascending: false }).limit(2000),
    supabase.from('site_cliques').select('dia, evento, aparelho, n').gte('dia', desde),
  ])
  const L = (leads ?? []) as Lead[]
  const C = (cliques ?? []) as Clique[]

  const soma = (ev: string) => C.filter((c) => c.evento === ev).reduce((s, c) => s + c.n, 0)
  const cliquesAndroid = soma('android')
  const n = {
    cad: L.length,
    ini: L.filter((l) => l.download_inicio_em).length,
    fim: L.filter((l) => l.download_fim_em).length,
    abriu: L.filter((l) => l.abriu_app_em || l.conta_id).length,
    conta: L.filter((l) => l.conta_id).length,
  }
  const porAparelho = ['android', 'desktop', 'ios', 'outro'].map((a) => ({ label: a, value: L.filter((l) => (l.aparelho ?? 'outro') === a).length }))
  const porOrigem = Object.entries(L.reduce<Record<string, number>>((m, l) => { const k = l.utm?.utm_source || l.origem || 'site'; m[k] = (m[k] ?? 0) + 1; return m }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }))
  const lista = filtro ? L.filter((l) => l.etapa === filtro) : L

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Downloads Android</h1>
          <p className="text-xs text-muted">Cadastro do APK no site (nome + WhatsApp) até a conta criada · <Link className="underline" href="/alunos">mesa de alunos</Link></p>
        </div>
        <div className="flex gap-1 text-[11px]">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/downloads?dias=${d}${filtro ? `&etapa=${filtro}` : ''}`}
              className={`rounded-full border px-2 py-0.5 ${d === dias ? 'border-brand bg-brandSoft text-brandText' : 'border-border text-fg2'}`}>{d} dias</Link>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 text-xs text-p0">Erro ao ler os cadastros: {error.message}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4"><div className="kicker">Cliques no botão</div><div className="font-display text-3xl font-extrabold">{cliquesAndroid}</div><div className="text-xs text-muted">{soma('whatsapp')} pelo WhatsApp · {soma('ios')} na App Store</div></div>
        <div className="card p-4"><div className="kicker">Cadastros</div><div className="font-display text-3xl font-extrabold">{n.cad}</div><div className="text-xs text-muted">{pct(n.cad, cliquesAndroid)} de quem clicou</div></div>
        <div className="card p-4"><div className="kicker">Download completo</div><div className="font-display text-3xl font-extrabold">{n.fim}</div><div className="text-xs text-muted">{pct(n.fim, n.cad)} dos cadastros · {n.ini - n.fim} pararam no meio</div></div>
        <div className="card p-4"><div className="kicker">Criaram conta</div><div className="font-display text-3xl font-extrabold">{n.conta}</div><div className="text-xs text-muted">{pct(n.conta, n.cad)} dos cadastros</div></div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <h3 className="card-h">Funil</h3>
          <div className="mt-2">
            <BarList data={[
              { label: 'Clicou', value: cliquesAndroid },
              { label: 'Cadastrou', value: n.cad },
              { label: 'Começou download', value: n.ini },
              { label: 'Terminou download', value: n.fim },
              { label: 'Abriu o app', value: n.abriu, hint: 'código lido pelo app ou conta encontrada' },
              { label: 'Criou conta', value: n.conta, hint: 'pelo código ou pelo telefone igual' },
            ]} format={(v) => `${v}`} />
          </div>
        </div>
        <div className="card p-4"><h3 className="card-h">Aparelho do cadastro</h3><div className="mt-2"><BarList data={porAparelho} /></div>
          <p className="kicker mt-2">desktop = preencheu no computador e baixou pelo QR.</p></div>
        <div className="card p-4"><h3 className="card-h">De onde veio</h3><div className="mt-2"><BarList data={porOrigem} /></div>
          <p className="kicker mt-2">utm_source do link, ou o botão clicado (hero, final, rodapé).</p></div>
      </div>

      <div className="card mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="card-h">Cadastros ({lista.length})</h3>
          <div className="flex flex-wrap gap-1 text-[11px]">
            <Link href={`/downloads?dias=${dias}`} className={`rounded-full border px-2 py-0.5 ${!filtro ? 'border-brand bg-brandSoft text-brandText' : 'border-border text-fg2'}`}>todos</Link>
            {(Object.keys(ETAPA) as Lead['etapa'][]).map((k) => (
              <Link key={k} href={`/downloads?dias=${dias}&etapa=${k}`}
                className={`rounded-full border px-2 py-0.5 ${filtro === k ? 'border-brand bg-brandSoft text-brandText' : 'border-border text-fg2'}`}>
                {ETAPA[k].label} ({L.filter((l) => l.etapa === k).length})
              </Link>
            ))}
          </div>
        </div>
        {lista.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Nenhum cadastro neste período.</p>
        ) : (
          <table className="mt-2 w-full text-[11px]">
            <thead><tr className="text-left text-muted"><th className="py-1">Quando</th><th>Nome</th><th>WhatsApp</th><th>Etapa</th><th>Download</th><th>Conta</th><th>Origem</th></tr></thead>
            <tbody>
              {lista.map((l) => {
                const dig = telefoneDigitos(l.telefone)
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-1 font-mono">{quando(l.criado_em)}</td>
                    <td>{l.nome}{l.cadastros > 1 && <span className="text-muted"> ×{l.cadastros}</span>}</td>
                    <td>{dig ? <a className="underline" href={`https://wa.me/${dig}`} target="_blank" rel="noreferrer">{formatarTelefone(l.telefone) ?? l.telefone}</a> : l.telefone}</td>
                    <td><span className={`rounded-full border px-2 py-0.5 font-display text-[10px] font-extrabold ${ETAPA[l.etapa].cls}`}>{ETAPA[l.etapa].label}</span></td>
                    <td className="text-muted">{l.download_fim_em ? `completo ${quando(l.download_fim_em)}` : l.download_inicio_em ? `começou ${quando(l.download_inicio_em)}` : '—'}{l.downloads > 1 ? ` · ${l.downloads}×` : ''}</td>
                    <td>{l.conta_id ? <Link className="underline" href={`/alunos?u=${l.conta_id}`}>{l.conta_nome || 'abrir'}</Link> : '—'}{l.conta_ligada_por && <span className="text-muted"> ({l.conta_ligada_por})</span>}</td>
                    <td className="text-muted">{l.utm?.utm_source || l.origem || '—'} · {l.aparelho ?? '?'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="kicker mt-2">Código {`DK-…`} vai no link do APK e na área de transferência; o app lê na 1ª abertura (APK a partir da próxima build). Sem código, a conta é achada pelo telefone (DDD + 8 últimos dígitos).</p>
      </div>
    </div>
  )
}
