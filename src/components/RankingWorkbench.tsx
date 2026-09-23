import Link from 'next/link'
import { GRUPO_META, diffDays, type Grupo } from '@/lib/analytics'
import { PerfilPopup, type PerfilResumo } from '@/components/PerfilPopup'

export type Linha = {
  id: string; nome: string; user: string | null; pontos: number; ofensiva: number; maiorOfensiva: number
  diasAt: number; ultAb: string | null; grupo: Grupo; premium: boolean
  escola: string; escolaCurta: string; escolaSlug: string; ano: string; canal: string; canalLabel: string
  posicao?: number
}
export type Filtros = { q: string; escola: string; ano: string; canal: string; grupo: string; ativos: boolean }

const fmt = (n: number) => n.toLocaleString('pt-BR')

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
function Bars({ itens, max }: { itens: { label: string; value: number; sub?: string }[]; max: number }) {
  return (
    <div className="space-y-1.5">
      {itens.map((i) => (
        <div key={i.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-[11px]">
          <span className="truncate text-fg2" title={i.label}>{i.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-brand" style={{ width: `${max ? (i.value / max) * 100 : 0}%` }} /></div>
          <span className="whitespace-nowrap text-fg2"><b className="text-fg">{fmt(i.value)}</b>{i.sub ? ` · ${i.sub}` : ''}</span>
        </div>
      ))}
    </div>
  )
}
const Avatar = ({ l, size = 28 }: { l: Linha; size?: number }) => (
  <span className="relative flex shrink-0 items-center justify-center rounded-full bg-brand font-display font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.4 }}>
    {l.nome.trim().charAt(0).toUpperCase()}
    {l.premium && <span className="absolute rotate-[20deg]" style={{ top: -size * 0.3, right: -size * 0.22, fontSize: size * 0.4 }}>👑</span>}
  </span>
)

/** monta a URL mantendo os outros filtros */
function href(f: Filtros, over: Partial<Filtros>) {
  const n = { ...f, ...over }
  const p = new URLSearchParams()
  if (n.q) p.set('q', n.q)
  if (n.escola) p.set('escola', n.escola)
  if (n.ano) p.set('ano', n.ano)
  if (n.canal) p.set('canal', n.canal)
  if (n.grupo) p.set('grupo', n.grupo)
  if (n.ativos) p.set('ativos', '1')
  const s = p.toString()
  return `/ranking${s ? `?${s}` : ''}`
}

/* ── coluna 1: resumo do recorte ──────────────────────────────────────────── */

export function RankingResumo({ lista, total, filtros }: { lista: Linha[]; total: number; filtros: Filtros }) {
  const soma = lista.reduce((n, l) => n + l.pontos, 0)
  const media = lista.length ? Math.round(soma / lista.length) : 0
  const mediana = lista.length ? lista[Math.floor(lista.length / 2)].pontos : 0
  const comPontos = lista.filter((l) => l.pontos > 0).length
  const agrupa = (chave: (l: Linha) => string) => {
    const m = new Map<string, { value: number; n: number }>()
    for (const l of lista) { const k = chave(l); const v = m.get(k) ?? { value: 0, n: 0 }; v.value += l.pontos; v.n += 1; m.set(k, v) }
    return [...m.entries()].map(([label, v]) => ({ label, value: v.value, sub: `${v.n} ${v.n === 1 ? 'conta' : 'contas'}` })).sort((x, y) => y.value - x.value)
  }
  const porEscola = agrupa((l) => l.escolaCurta)
  const porAno = agrupa((l) => l.ano)
  const podio = lista.slice(0, 3)
  const temFiltro = !!(filtros.q || filtros.escola || filtros.ano || filtros.canal || filtros.grupo || filtros.ativos)
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto border-r bg-surface/40 px-3 py-3.5">
      <div className="flex items-center gap-2">
        <div className="font-display text-base font-extrabold">Ranking</div>
        <span className="text-xs text-fg2">{lista.length}{temFiltro ? ` de ${total}` : ''} contas</span>
        {temFiltro && <Link href="/ranking" className="chip ml-auto">limpar filtros</Link>}
      </div>

      <Card icon="🏆" title="Pódio" tag={temFiltro ? 'do recorte' : 'geral'}>
        <div className="space-y-2">
          {podio.length === 0 && <p className="text-xs text-muted">Ninguém com esse filtro.</p>}
          {podio.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2.5">
              <span className="w-6 text-center font-display text-lg font-extrabold">{['🥇', '🥈', '🥉'][i]}</span>
              <Avatar l={l} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold">{l.user ? `@${l.user}` : l.nome}</span>
                <span className="block truncate text-[11px] text-muted">{l.escolaCurta} · {l.ano}</span>
              </span>
              <span className="font-display text-base font-extrabold text-brandText">{fmt(l.pontos)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card icon="📊" title="Números" tag="pontos">
        <div className="grid grid-cols-2 gap-2">
          <div><div className="font-display text-xl font-extrabold leading-none">{fmt(soma)}</div><div className="kicker">pontos somados</div></div>
          <div><div className="font-display text-xl font-extrabold leading-none">{fmt(media)}</div><div className="kicker">média por conta</div></div>
          <div><div className="font-display text-xl font-extrabold leading-none">{fmt(mediana)}</div><div className="kicker">mediana</div></div>
          <div><div className="font-display text-xl font-extrabold leading-none">{comPontos}</div><div className="kicker">com algum ponto</div></div>
        </div>
      </Card>

      <Card icon="🏫" title="Pontos por escola" tag="soma">
        <Bars itens={porEscola} max={Math.max(1, ...porEscola.map((i) => i.value))} />
      </Card>

      <Card icon="🎓" title="Pontos por ano" tag="soma" grow>
        <Bars itens={porAno} max={Math.max(1, ...porAno.map((i) => i.value))} />
      </Card>
    </div>
  )
}

/* ── coluna 2: filtros + tabela ───────────────────────────────────────────── */

export function RankingLista({ lista, filtros, opcoes, perfis, hoje }: {
  lista: Linha[]; filtros: Filtros
  opcoes: { escolas: { slug: string; curto: string; escola: string }[]; anos: string[]; canais: { k: string; label: string }[] }
  perfis: Record<string, PerfilResumo>; hoje: string
}) {
  const chip = (on: boolean, to: string, label: string, title?: string) => (
    <Link key={to + label} href={to} scroll={false} title={title} className={`chip ${on ? 'chip-on' : ''}`}>{label}</Link>
  )
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b px-3 pb-2.5 pt-3">
        <form method="get" action="/ranking" className="flex items-center gap-2">
          {filtros.escola && <input type="hidden" name="escola" value={filtros.escola} />}
          {filtros.ano && <input type="hidden" name="ano" value={filtros.ano} />}
          {filtros.canal && <input type="hidden" name="canal" value={filtros.canal} />}
          {filtros.grupo && <input type="hidden" name="grupo" value={filtros.grupo} />}
          {filtros.ativos && <input type="hidden" name="ativos" value="1" />}
          <input name="q" defaultValue={filtros.q} placeholder="Nome, usuário, escola…" className="input" />
        </form>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="kicker mr-1">Escola</span>
          {chip(!filtros.escola, href(filtros, { escola: '' }), 'Todas')}
          {opcoes.escolas.map((e) => chip(filtros.escola === e.slug, href(filtros, { escola: filtros.escola === e.slug ? '' : e.slug }), e.curto, e.escola))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="kicker mr-1">Ano</span>
          {chip(!filtros.ano, href(filtros, { ano: '' }), 'Todos')}
          {opcoes.anos.map((an) => chip(filtros.ano === an, href(filtros, { ano: filtros.ano === an ? '' : an }), an))}
          <span className="kicker ml-3 mr-1">Chegou por</span>
          {opcoes.canais.map((c) => chip(filtros.canal === c.k, href(filtros, { canal: filtros.canal === c.k ? '' : c.k }), c.label))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="kicker mr-1">Frequência</span>
          {(Object.keys(GRUPO_META) as Grupo[]).map((g) => chip(filtros.grupo === g, href(filtros, { grupo: filtros.grupo === g ? '' : g }), GRUPO_META[g].tag, GRUPO_META[g].sub))}
          {chip(filtros.ativos, href(filtros, { ativos: !filtros.ativos }), 'Só quem abriu nos últimos 14 dias')}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {lista.length === 0 && <div className="p-10 text-center text-sm text-muted">Ninguém com esse filtro.</div>}
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-bg text-left text-[10px] uppercase tracking-wide text-muted">
            <tr><th className="px-3 py-2 text-right">#</th><th className="px-2 py-2">Aluno</th><th className="px-2 py-2 text-right">Pontos</th><th className="px-2 py-2 text-right">Ofensiva</th><th className="px-2 py-2">Escola</th><th className="px-2 py-2">Ano</th><th className="px-2 py-2">Frequência</th><th className="px-2 py-2">Última abertura</th><th className="px-2 py-2"></th></tr>
          </thead>
          <tbody>
            {lista.map((l, i) => (
              <tr key={l.id} className="border-t border-borderSubtle hover:bg-surface">
                <td className="px-3 py-1.5 text-right font-display font-extrabold text-fg2" title={`posição geral #${l.posicao}`}>{i + 1}{l.posicao !== i + 1 && <span className="ml-1 text-[10px] font-normal text-muted">({l.posicao}º geral)</span>}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar l={l} />
                    <div className="min-w-0"><div className="truncate font-bold text-fg">{l.user ? `@${l.user}` : l.nome}</div>{l.user && <div className="truncate text-[11px] text-muted">{l.nome}</div>}</div>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right font-display text-sm font-extrabold text-brandText">{fmt(l.pontos)}</td>
                <td className="px-2 py-1.5 text-right text-fg2" title={`maior ofensiva: ${l.maiorOfensiva} dias`}>{l.ofensiva > 0 ? `🔥 ${l.ofensiva}` : '—'}</td>
                <td className="px-2 py-1.5 text-fg2" title={l.escola}>{l.escolaCurta}</td>
                <td className="px-2 py-1.5 text-fg2">{l.ano}</td>
                <td className="px-2 py-1.5"><span className="rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold text-white" style={{ background: GRUPO_META[l.grupo].cor }}>{GRUPO_META[l.grupo].tag}</span> <span className="text-[11px] text-muted">{l.diasAt}d</span></td>
                <td className="px-2 py-1.5 text-[11px] text-muted">{l.ultAb ? `há ${diffDays(l.ultAb, hoje)}d` : 'nunca'}</td>
                <td className="px-2 py-1.5">{perfis[l.id] && <PerfilPopup p={perfis[l.id]} rotulo="ver" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
