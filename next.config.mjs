/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `next build` com o `next dev` aberto trava no `.next/trace` (EPERM). Com
  // NEXT_DIST_DIR dá pra buildar numa pasta à parte sem derrubar o dev.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // O painel só conversa com o Supabase remoto; nada de imagens externas.
  eslint: {
    // Não há config de ESLint neste projeto — o typecheck do build já cobre erros.
    ignoreDuringBuilds: true,
  },
  // O drive G: é exFAT e não suporta symlinks; o webpack chama readlink nos
  // arquivos e quebra com EISDIR. Desligar a resolução de symlinks ajuda.
  // (Em Linux/Vercel é inócuo — lá o build roda em ext4 normalmente.)
  webpack: (config) => {
    config.resolve.symlinks = false
    return config
  },
}

export default nextConfig
