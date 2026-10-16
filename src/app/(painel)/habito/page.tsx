import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { addDays, hojeSP, diffDays } from '@/lib/analytics'
import { BarList } from '@/components/charts/BarList'
import { Sparkbars } from '@/components/charts/Sparkbars'

export const dynamic = 'force-dynamic'

/**
 * Hábito — a métrica-guia do plano de engajamento (Path_app/docs/plano-engajamento.md).
 *
 * Baldes do Duolingo por dia (novo / atual / reativado / ressuscitado), CURR
 * semanal (quem estava ativo na semana passada e continuou), funil de ativação
 * das últimas coortes, cobertura de push e hora alvo (migration 115) e o
 * desempenho dos templates do motor de lembretes (lembretes_enviados).
 */

type U = { id: string; created_at: string; onboarding_completed: boolean | null; lembrete_h: number | null; lembrete_fonte: string | null; lembretes_ativos: boolean | null; current_streak: number | null; last_activity_date: string | null }
type Open = { user_id: string; dia: string; aberturas: number }
type Lanc = { user_id: string; criado_em: string; acao: string }
type Lem = { template: string; passo: string; enviado_em: string; aberto_em: string | null; convertido_em: string | null; erro: string | null }
type Ab = { origem: string; aberto_em: string }

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
const br = (iso: string) => iso.slice(5).split('-').reverse().join('/')
const diaSP = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export default async function HabitoPage() {
  const supabase = await supabaseServer()
  const pub = supabase.schema('public')
  const hoje = hojeSP()
  const d60 = addDays(hoje, -60)

  const [{ data: users }, { data: opens }, { data: lancs }, { data: lems }, { data: abs }, { data: toks }, { data: cfg }] = await Promise.all([
    pub.from('users').select('id, created_at, onboarding_completed, lembrete_h, lembrete_fonte, lembretes_ativos, current_streak, last_activity_date').limit(5000),
    pub.from('app_opens').select('user_id, dia, aberturas').limit(50000),
    pub.from('pontos_lancamentos').select('user_id, criado_em, acao').gte('criado_em', `${d60}T00:00:00Z`).limit(50000),
    pub.from('lembretes_enviados').select('template, passo, enviado_em, aberto_em, convertido_em, erro').gte('enviado_em', `${d60}T00:00:00Z`).limit(20000),
    pub.from('aberturas').select('origem, aberto_em').gte('aberto_em', `${addDays(hoje, -30)}T00:00:00Z`).limit(50000),
    pub.from('push_tokens').select('user_id').limit(5000),
    pub.from('app_settings').select('lembretes_envio').eq('id', 1).maybeSingle(),
  ])

  const U = (users ?? []) as U[]
  const O = (opens ?? []) as Open[]
  const L = (lancs ?? []) as Lanc[]
  const LE = (lems ?? []) as Lem[]
  const AB = (abs ?? []) as Ab[]
  const comPush = new Set(((toks ?? []) as { user_id: string }[]).map((t) => t.user_id))
  const criado = new Map(U.map((u) => [u.id, u.created_at.slice(0, 10)]))

  // ── dias ativos por conta (abriu o app) e dias em que estudou ─────────────
  const ativos = new Map<string, Set<string>>()
  for (const o of O) { if (!ativos.has(o.user_id)) ativos.set(o.user_id, new Set()); ativos.get(o.user_id)!.add(o.dia) }
  const estudou = new Map<string, Set<string>>()
  for (const l of L) {
    if (l.acao === 'ajuste_inicial' || l.acao === 'onboarding') continue
    if (!estudou.has(l.user_id)) estudou.set(l.user_id, new Set()); estudou.get(l.user_id)!.add(diaSP(l.criado_em))
  }

  // ── baldes por dia (últimos 14 dias) ──────────────────────────────────────
  type Balde = 'novo' | 'atual' | 'reativado' | 'ressuscitado'
  const dias: { dia: string; novo: number; atual: number; reativado: number; ressuscitado: number; total: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const dia = addDays(hoje, -i)
    const c = { dia, novo: 0, atual: 0, reativado: 0, ressuscitado: 0, total: 0 }
    for (const [uid, set] of ativos) {
      if (!set.has(dia)) continue
      let balde: Balde
      if (criado.get(uid) === dia) balde = 'novo'
      else {
        // último dia ativo antes deste
        let ult: string | null = null
        for (const d of set) if (d < dia && (!ult || d > ult)) ult = d
        const gap = ult ? diffDays(ult, dia) : 999
        balde = gap <= 6 ? 'atual' : gap <= 29 ? 'reativado' : 'ressuscitado'
      }
      c[balde]++; c.total++
    }
    dias.push(c)
  }

  // ── CURR semanal (6 semanas): ativos na semana W que já eram ativos em W−1 ──
  const semanas: { ini: string; fim: string; wau: number; curr: number; estudaram: number }[] = []
  for (let w = 5; w >= 0; w--) {
    const fim = addDays(hoje, -7 * w), ini = addDays(fim, -6)
    const iniAnt = addDays(ini, -7), fimAnt = addDays(ini, -1)
    const ativoEm = (set: Set<string>, a: string, b: string) => { for (const d of set) if (d >= a && d <= b) return true; return false }
    let wau = 0, antes = 0, ambos = 0, est = 0
    for (const [uid, set] of ativos) {
      const agora = ativoEm(set, ini, fim), ant = ativoEm(set, iniAnt, fimAnt)
      if (agora) wau++
      if (ant) antes++
      if (agora && ant) ambos++
      if (estudou.get(uid) && ativoEm(estudou.get(uid)!, ini, fim)) est++
    }
    semanas.push({ ini, fim, wau, curr: antes ? Math.round((ambos / antes) * 100) : 0, estudaram: est })
  }

  // ── funil de ativação (contas dos últimos 30 dias, com pelo menos 8 dias de vida) ──
  const coorte = U.filter((u) => { const c = u.created_at.slice(0, 10); return c >= addDays(hoje, -30) && c <= addDays(hoje, -8) })
  const f = { contas: coorte.length, sessaoD0: 0, d1: 0, semana2: 0, push: 0 }
  for (const u of coorte) {
    const c = u.created_at.slice(0, 10)
    const e = estudou.get(u.id), a = ativos.get(u.id)
    if (e?.has(c)) f.sessaoD0++
    if (a?.has(addDays(c, 1))) f.d1++
    if (a && [...a].some((d) => d >= addDays(c, 7) && d <= addDays(c, 13))) f.semana2++
    if (comPush.has(u.id)) f.push++
  }

  // ── ofensiva hoje ──────────────────────────────────────────────────────────
  const ofensiva = { zero: 0, curta: 0, media: 0, semana: 0 }
  for (const u of U) {
    const viva = u.last_activity_date && u.last_activity_date >= addDays(hoje, -1) ? (u.current_streak ?? 0) : 0
    if (viva === 0) ofensiva.zero++; else if (viva <= 2) ofensiva.curta++; else if (viva <= 6) ofensiva.media++; else ofensiva.semana++
  }

  // ── push e hora alvo ──────────────────────────────────────────────────────
  const onboarded = U.filter((u) => u.onboarding_completed)
  const pushN = onboarded.filter((u) => comPush.has(u.id)).length
  const ativosLem = onboarded.filter((u) => u.lembretes_ativos !== false).length
  const horas = new Map<number, number>()
  for (const u of onboarded) if (u.lembrete_h !== null) horas.set(u.lembrete_h, (horas.get(u.lembrete_h) ?? 0) + 1)
  const horasData = [...horas.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => ({ label: `${String(h).padStart(2, '0')}h`, value: n }))
  const fontes = { escolhida: 0, calculada: 0, padrao: 0 }
  for (const u of onboarded) { const k = (u.lembrete_fonte ?? 'padrao') as keyof typeof fontes; if (k in fontes) fontes[k]++ }

  // ── templates ─────────────────────────────────────────────────────────────
  const porT = new Map<string, { env: number; ab: number; conv: number; erro: number }>()
  for (const l of LE) {
    if (l.passo === 'teste') continue
    const t = porT.get(l.template) ?? { env: 0, ab: 0, conv: 0, erro: 0 }
    if (l.erro) t.erro++; else { t.env++; if (l.aberto_em) t.ab++; if (l.convertido_em) t.conv++ }
    porT.set(l.template, t)
  }
  const templates = [...porT.entries()].sort((a, b) => b[1].env - a[1].env)
  const envios14 = new Map<string, number>()
  for (const l of LE) { if (l.erro || l.passo === 'teste') continue; const d = diaSP(l.enviado_em); envios14.set(d, (envios14.get(d) ?? 0) + 1) }
  const origens = { icone: 0, notificacao: 0, widget: 0, link: 0 }
  for (const a of AB) if (a.origem in origens) origens[a.origem as keyof typeof origens]++

  const mapaBalde: { k: Balde; label: string; cor: string }[] = [
    { k: 'novo', label: 'Novos', cor: 'bg-ok/70' }, { k: 'atual', label: 'Atuais (ativos na semana)', cor: 'bg-brand/70' },
    { k: 'reativado', label: 'Reativados (7–29 dias fora)', cor: 'bg-p1/60' }, { k: 'ressuscitado', label: 'Ressuscitados (30+ dias)', cor: 'bg-p0/60' },
  ]

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Hábito</h1>
          <p className="text-xs text-muted">A métrica-guia: quem volta. Baldes e CURR como no Duolingo · <Link className="underline" href="/alunos">mesa de alunos</Link></p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 font-display text-[10px] font-extrabold ${cfg?.lembretes_envio ? 'border-ok/50 bg-ok/15 text-ok' : 'border-border bg-elev text-fg2'}`}>
          motor de lembretes: {cfg?.lembretes_envio ? 'LIGADO' : 'ENSAIO (não envia)'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {semanas.slice(-1).map((s) => (
          <div key="curr" className="card p-4">
            <div className="kicker">CURR desta semana</div>
            <div className="font-display text-3xl font-extrabold">{s.curr}%</div>
            <div className="text-xs text-muted">dos ativos da semana passada voltaram ({s.wau} ativos · {s.estudaram} estudaram)</div>
          </div>
        ))}
        <div className="card p-4">
          <div className="kicker">Ativos hoje</div>
          <div className="font-display text-3xl font-extrabold">{dias[dias.length - 1].total}</div>
          <div className="text-xs text-muted">{dias[dias.length - 1].novo} novos · {dias[dias.length - 1].atual} atuais · {dias[dias.length - 1].reativado + dias[dias.length - 1].ressuscitado} de volta</div>
        </div>
        <div className="card p-4">
          <div className="kicker">Ofensiva viva</div>
          <div className="font-display text-3xl font-extrabold">{ofensiva.media + ofensiva.semana}</div>
          <div className="text-xs text-muted">{ofensiva.semana} com 7+ dias · {ofensiva.media} com 3–6 · {ofensiva.curta} com 1–2 · {ofensiva.zero} sem</div>
        </div>
        <div className="card p-4">
          <div className="kicker">Push ligado</div>
          <div className="font-display text-3xl font-extrabold">{pct(pushN, onboarded.length)}</div>
          <div className="text-xs text-muted">{pushN} de {onboarded.length} contas · {ativosLem} aceitam lembrete</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="card-h">Baldes por dia (14 dias)</h3>
          <div className="mt-2 space-y-1">
            {dias.map((d) => (
              <div key={d.dia} className="flex items-center gap-2 text-[11px]">
                <span className="w-10 font-mono text-muted">{br(d.dia)}</span>
                <div className="flex h-4 flex-1 overflow-hidden rounded bg-bg">
                  {mapaBalde.map((m) => d.total ? <div key={m.k} className={`h-full ${m.cor}`} style={{ width: `${(d[m.k] / Math.max(1, ...dias.map((x) => x.total))) * 100}%` }} title={`${m.label}: ${d[m.k]}`} /> : null)}
                </div>
                <span className="w-8 text-right font-mono">{d.total}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted">
            {mapaBalde.map((m) => <span key={m.k} className="flex items-center gap-1"><i className={`inline-block h-2 w-2 rounded-sm ${m.cor}`} />{m.label}</span>)}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="card-h">CURR por semana</h3>
          <table className="mt-2 w-full text-[11px]">
            <thead><tr className="text-left text-muted"><th className="py-1">Semana</th><th>Ativos</th><th>Estudaram</th><th>CURR</th></tr></thead>
            <tbody>
              {semanas.map((s) => (
                <tr key={s.ini} className="border-t border-border">
                  <td className="py-1 font-mono">{br(s.ini)}–{br(s.fim)}</td>
                  <td>{s.wau}</td><td>{s.estudaram}</td>
                  <td className="font-display font-extrabold">{s.curr}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="kicker mt-2">CURR = ativos esta semana que também estavam ativos na anterior ÷ ativos na anterior. É a alavanca que mais move DAU.</p>
        </div>

        <div className="card p-4">
          <h3 className="card-h">Funil de ativação</h3>
          <p className="kicker">Contas criadas entre {br(addDays(hoje, -30))} e {br(addDays(hoje, -8))} ({f.contas})</p>
          <div className="mt-2">
            <BarList data={[
              { label: 'Cadastro', value: f.contas },
              { label: 'Estudou no dia 0', value: f.sessaoD0, hint: 'fez sessão, redação ou flashcard no dia do cadastro' },
              { label: 'Voltou no dia 1', value: f.d1 },
              { label: 'Ativo na 2ª semana', value: f.semana2 },
              { label: 'Push ligado', value: f.push },
            ]} format={(v) => `${v} (${pct(v, f.contas)})`} />
          </div>
        </div>

        <div className="card p-4">
          <h3 className="card-h">Hora alvo do lembrete</h3>
          <p className="kicker">{fontes.escolhida} escolhida no app · {fontes.calculada} calculada pelo uso · {fontes.padrao} padrão (19h)</p>
          <div className="mt-2"><BarList data={horasData} /></div>
        </div>

        <div className="card p-4 md:col-span-2">
          <h3 className="card-h">Templates do motor (60 dias)</h3>
          {templates.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Nenhum envio ainda. Com a chave em ensaio o motor decide e não grava; ligue em <code>app_settings.lembretes_envio</code> pra começar a medir.</p>
          ) : (
            <table className="mt-2 w-full text-[11px]">
              <thead><tr className="text-left text-muted"><th className="py-1">Template</th><th>Enviados</th><th>Abertos</th><th>Estudaram em 2 h</th><th>Conversão</th><th>Erros</th></tr></thead>
              <tbody>
                {templates.map(([t, v]) => (
                  <tr key={t} className="border-t border-border">
                    <td className="py-1 font-mono">{t}</td><td>{v.env}</td><td>{v.ab} ({pct(v.ab, v.env)})</td><td>{v.conv}</td>
                    <td className="font-display font-extrabold">{pct(v.conv, v.env)}</td><td className="text-muted">{v.erro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <div className="kicker mb-1">Envios por dia</div>
              <Sparkbars data={Array.from({ length: 14 }, (_, i) => { const d = addDays(hoje, -13 + i); return { day: d, value: envios14.get(d) ?? 0 } })} />
            </div>
            <div>
              <div className="kicker mb-1">Aberturas por origem (30 dias)</div>
              <BarList data={[
                { label: 'Ícone', value: origens.icone }, { label: 'Notificação', value: origens.notificacao },
                { label: 'Widget', value: origens.widget }, { label: 'Link', value: origens.link },
              ]} />
              <p className="kicker mt-1">Só contas com a versão nova do app registram a origem.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
