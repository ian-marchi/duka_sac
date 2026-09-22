import type { ResumoAlunos, StatusAluno } from '@/lib/alunos'
import { STATUS_META } from '@/lib/alunos'
import { GRUPO_META } from '@/lib/analytics'

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%')

/**
 * Seção "Alunos abordados no WhatsApp" da visão geral.
 *
 * Fica SEPARADA da análise de users × app_opens × ai_usage de propósito: a
 * fonte é a planilha `data/alunos_duka.csv`, mantida à mão. Trocar o arquivo
 * atualiza tudo aqui; nada é gravado no banco.
 */
export function AlunosBeta({ r }: { r: ResumoAlunos }) {
  const atualizado = r.atualizadoEm
    ? new Date(r.atualizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
    : null
  const maxEscola = Math.max(1, ...r.escolas.map((e) => e.value))
  const maxAno = Math.max(1, ...r.anos.map((e) => e.value))
  const statusOrdem: StatusAluno[] = ['respondeu', 'nao_respondeu', 'sem_dados']
  const statusVals: Record<StatusAluno, number> = { respondeu: r.responderam, nao_respondeu: r.naoResponderam, sem_dados: r.semDados }
  const comConta = r.alunos.filter((a) => a.conta)

  return (
    <section className="mx-auto mt-10 max-w-6xl px-4 pb-10 md:px-6">
      <div className="rounded-3xl border-2 border-dashed border-brand/40 p-4 md:p-5">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Alunos abordados no WhatsApp (beta)</h2>
            <p className="mt-1 max-w-[70ch] text-xs text-muted">
              Fonte separada da análise acima: a planilha <code>{r.arquivo}</code>
              {atualizado ? ` (arquivo de ${atualizado})` : ''}. Pra atualizar, troque o arquivo e recarregue —
              nada vai pro banco. O cruzamento com as contas do app é por nome completo.
            </p>
          </div>
        </header>

        {r.total === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted">
            Não achei <code>{r.arquivo}</code>. Coloque o CSV lá com as colunas
            <code> Contato WhatsApp, Nome, Telefone informado, Escola, Ano, Status, Observação</code>.
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi label="Contatos na lista" v={r.total} foot="cada linha do CSV" />
              <Kpi label="Responderam" v={r.responderam} s={pct(r.responderam, r.total)} foot={`${r.professores} são professores`} cor={STATUS_META.respondeu.cor} />
              <Kpi label="Não responderam" v={r.naoResponderam} s={pct(r.naoResponderam, r.total)} foot={`${r.semDados} sem dados na conversa`} cor={STATUS_META.nao_respondeu.cor} />
              <Kpi label="Com conta no app" v={r.comConta} s={pct(r.comConta, r.responderam)} foot="dos que responderam, pelo nome" cor="rgb(91 52 199)" />
              <Kpi label="Travaram pra entrar" v={r.avisos.find((a) => a.tipo === 'Travou pra entrar no app')?.itens.length ?? 0} foot="código, cadastro ou Android" cor="rgb(220 38 38)" />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Card title="Status do contato">
                {statusOrdem.map((s) => <Bar key={s} label={STATUS_META[s].label} v={statusVals[s]} max={r.total} cor={STATUS_META[s].cor} />)}
              </Card>
              <Card title="Escola (quem respondeu)">
                {r.escolas.map((e) => <Bar key={e.label} label={e.label} v={e.value} max={maxEscola} cor="rgb(29 111 196)" />)}
              </Card>
              <Card title="Ano (quem respondeu)">
                {r.anos.map((e) => <Bar key={e.label} label={e.label} v={e.value} max={maxAno} cor="rgb(91 52 199)" />)}
              </Card>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Card title="Avisos tirados da coluna Observação">
                {r.avisos.length === 0 ? <p className="text-xs text-muted">Nenhuma observação.</p> : r.avisos.map((g) => (
                  <details key={g.tipo} className="rounded-lg border bg-bg/40 px-3 py-2" open={g.tipo === 'Travou pra entrar no app'}>
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium">{g.tipo}</span> <span className="text-xs text-muted">· {g.itens.length}</span>
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {g.itens.map((i, k) => (
                        <li key={k} className="flex flex-wrap gap-x-2">
                          <span className="font-medium">{i.nome}</span>
                          <span className="font-mono text-muted">{i.contato}</span>
                          <span className="basis-full text-fg/70">{i.obs}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </Card>
              <Card title="Quem já criou conta no app">
                {comConta.length === 0 ? (
                  <p className="text-xs text-muted">Nenhum nome da planilha bate com uma conta. Ou ninguém entrou ainda, ou cadastraram com outro nome.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {comConta.map((a) => (
                      <li key={a.contato} className="flex items-center gap-2">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: GRUPO_META[a.conta!.grupo].cor }} />
                        <span className="min-w-0 flex-1 truncate font-medium">{a.nome}</span>
                        <span className="text-muted">{a.escola.replace('E.E. Prof. ', '')} · {a.ano}</span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted">{GRUPO_META[a.conta!.grupo].tag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Tabela completa, fechada por padrão */}
            <details className="mt-3 rounded-2xl border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold">Lista completa ({r.total})</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Nome</th>
                      <th className="py-1 pr-3 font-medium">WhatsApp</th>
                      <th className="py-1 pr-3 font-medium">Escola</th>
                      <th className="py-1 pr-3 font-medium">Ano</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                      <th className="py-1 pr-3 font-medium">Conta</th>
                      <th className="py-1 font-medium">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.alunos.map((a, i) => (
                      <tr key={`${a.contato}-${i}`} className="border-t">
                        <td className="py-1 pr-3 font-medium">{a.nome || <span className="text-muted">—</span>}</td>
                        <td className="py-1 pr-3 font-mono text-muted">{a.contato}</td>
                        <td className="py-1 pr-3" title={a.escolaBruta}>{a.nome ? a.escola : '—'}</td>
                        <td className="py-1 pr-3" title={a.anoBruto}>{a.nome ? a.ano : '—'}</td>
                        <td className="py-1 pr-3"><span className="inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: STATUS_META[a.status].cor }} /> {STATUS_META[a.status].label}</td>
                        <td className="py-1 pr-3">{a.conta ? <span title={a.conta.nome}>✓ {GRUPO_META[a.conta.grupo].tag}</span> : <span className="text-muted">—</span>}</td>
                        <td className="py-1 text-fg/70">{a.obs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-surface p-4"><h3 className="mb-3 text-sm font-semibold">{title}</h3><div className="space-y-2">{children}</div></div>
}
function Kpi({ label, v, s, foot, cor }: { label: string; v: string | number; s?: string; foot?: string; cor?: string }) {
  return (
    <div className="rounded-2xl border bg-surface p-4">
      <div className="text-xs text-muted">{cor && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: cor }} />}{label}</div>
      <div className="text-2xl font-bold leading-tight tracking-tight">{v}{s && <small className="ml-1 text-sm font-medium text-muted">{s}</small>}</div>
      {foot && <div className="mt-1 text-xs text-fg/70">{foot}</div>}
    </div>
  )
}
function Bar({ label, v, max, cor }: { label: string; v: number; max: number; cor: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr_36px] items-center gap-2 text-xs">
      <span className="truncate text-fg/80" title={label}>{label}</span>
      <div className="h-4 overflow-hidden rounded bg-bg"><div className="h-full rounded" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: cor }} /></div>
      <span className="text-right text-muted">{v}</span>
    </div>
  )
}
