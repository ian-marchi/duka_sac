'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Trilho de ícones (desenho F): 68px de largura no lugar da barra lateral de
 * 224px. Cada destino é um ícone com o rótulo no tooltip; o ativo ganha o
 * fundo roxo com a borda de baixo, igual ao botão clay do app.
 */
const ITENS: { href: string; label: string; icon: React.ReactNode; match: (p: string) => boolean }[] = [
  { href: '/',           label: 'Visão geral', match: (p) => p === '/',
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg> },
  { href: '/tickets',    label: 'Tickets', match: (p) => p.startsWith('/tickets') || p.startsWith('/t/'),
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-7h14l2 7v7H3z"/><path d="M3 12h5l1.5 3h5L16 12h5"/></svg> },
  { href: '/alunos',     label: 'Alunos', match: (p) => p.startsWith('/alunos'),
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/></svg> },
  { href: '/whatsapp',   label: 'WhatsApp (quem chegou pelo WhatsApp)', match: (p) => p.startsWith('/whatsapp'),
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8.2 19z"/><path d="M9 9.5c.3 2.6 2.4 4.7 5 5l1.2-1.2-1.8-1.2-1 .6a3.4 3.4 0 0 1-1.6-1.6l.6-1L10.2 8.3z"/></svg> },
  { href: '/ranking',    label: 'Ranking de pontos', match: (p) => p.startsWith('/ranking'),
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg> },
  { href: '/relatorios', label: 'Relatórios', match: (p) => p.startsWith('/relatorios'),
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg> },
  { href: '/metricas',   label: 'Métricas', match: (p) => p.startsWith('/metricas'),
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16"/><rect x="5" y="11" width="3.5" height="7" rx="1"/><rect x="10.25" y="6" width="3.5" height="12" rx="1"/><rect x="15.5" y="9" width="3.5" height="9" rx="1"/></svg> },
  { href: '/regras',     label: 'Regras de prioridade', match: (p) => p.startsWith('/regras'),
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="7" cy="17" r="2" fill="currentColor"/></svg> },
]

export function RailNav() {
  const path = usePathname()
  return (
    <nav className="flex flex-col items-center gap-1.5">
      {ITENS.map((it) => {
        const on = it.match(path)
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            aria-label={it.label}
            aria-current={on ? 'page' : undefined}
            className={`flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border transition
              ${on ? 'border-brand border-b-[3px] bg-brandSoft text-brandText' : 'border-transparent text-muted hover:bg-surface hover:text-fg'}`}
          >
            {it.icon}
          </Link>
        )
      })}
    </nav>
  )
}
