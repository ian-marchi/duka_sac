import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Duka · JARVIS',
  description: 'Painel privado do Duka: tickets, alunos e relatórios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Mesmas fontes do app (Baloo 2 + Nunito). Via <link> e não next/font
            porque o dev roda em máquina sem garantia de rede no build. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}
