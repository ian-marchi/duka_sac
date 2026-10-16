import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { NovaEscola } from '@/components/escolas/NovaEscola'

export const dynamic = 'force-dynamic'

type Escola = { id: string; nome: string; cidade: string | null; uf: string | null; status: string; premium_ate: string | null; contato_nome: string | null; criado_em: string }
type Aluno = { escola_id: string; status: string; user_id: string | null; convidado_em: string | null }

const STATUS: Record<string, { label: string; cls: string }> = {
  ativa: { label: 'Ativa', cls: 'border-ok/50 bg-ok/15 text-ok' },
  pausada: { label: 'Pausada', cls: 'border-p1/50 bg-p1/15 text-p1' },
  encerrada: { label: 'Encerrada', cls: 'border-border bg-elev text-fg2' },
}

export default async function EscolasPage() {
  const supabase = await supabaseServer()
  const [{ data: escolas, error }, { data: alunos }] = await Promise.all([
    supabase.from('escolas').select('id, nome, cidade, uf, status, premium_ate, contato_nome, criado_em').order('criado_em', { ascending: false }),
    supabase.from('escola_alunos').select('escola_id, status, user_id, convidado_em').limit(10000),
  ])
  if (error) return <div className="p-6 text-sm text-muted">Não consegui ler <code>support.escolas</code>: {error.message}</div>
  const E = (escolas ?? []) as Escola[]
  const A = (alunos ?? []) as Aluno[]

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Escolas parceiras</h1>
          <p className="text-xs text-muted">O diretor paga; os alunos da lista ganham Premium enquanto a escola estiver ativa. Quem não tem conta recebe o convite pelo WhatsApp.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {E.length === 0 && <div className="card p-6 text-center text-xs text-muted">Nenhuma escola ainda. Cadastre a primeira ao lado.</div>}
          {E.map((e) => {
            const as = A.filter((a) => a.escola_id === e.id && a.status !== 'removido')
            const comConta = as.filter((a) => a.user_id).length
            const premium = as.filter((a) => a.status === 'premium').length
            const pendentes = as.filter((a) => a.status === 'pendente').length
            const semConvite = as.filter((a) => a.status === 'pendente' && !a.convidado_em).length
            const st = STATUS[e.status] ?? STATUS.encerrada
            return (
              <Link key={e.id} href={`/escolas/${e.id}`} className="card flex items-center gap-4 p-4 hover:bg-elev">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-base font-extrabold">{e.nome}</span>
                    <span className={`rounded-full border px-2 py-0.5 font-display text-[10px] font-extrabold ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {[e.cidade, e.uf].filter(Boolean).join('/') || 'cidade não informada'}
                    {e.contato_nome ? ` · contato: ${e.contato_nome}` : ''}
                    {e.premium_ate ? ` · premium até ${e.premium_ate.split('-').reverse().join('/')}` : ' · premium enquanto ativa'}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center text-[11px]">
                  <div><div className="font-display text-lg font-extrabold">{as.length}</div><div className="kicker">alunos</div></div>
                  <div><div className="font-display text-lg font-extrabold">{comConta}</div><div className="kicker">com conta</div></div>
                  <div><div className="font-display text-lg font-extrabold text-ok">{premium}</div><div className="kicker">premium</div></div>
                  <div><div className={`font-display text-lg font-extrabold ${semConvite ? 'text-p1' : ''}`}>{pendentes}</div><div className="kicker">{semConvite ? `${semConvite} sem convite` : 'sem conta'}</div></div>
                </div>
              </Link>
            )
          })}
        </div>
        <NovaEscola />
      </div>
    </div>
  )
}
