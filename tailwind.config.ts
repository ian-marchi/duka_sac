import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           'rgb(var(--bg) / <alpha-value>)',
        surface:      'rgb(var(--surface) / <alpha-value>)',
        elev:         'rgb(var(--elev) / <alpha-value>)',
        border:       'rgb(var(--border) / <alpha-value>)',
        borderSubtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        fg:           'rgb(var(--fg) / <alpha-value>)',
        fg2:          'rgb(var(--fg2) / <alpha-value>)',
        muted:        'rgb(var(--muted) / <alpha-value>)',
        brand:        'rgb(var(--brand) / <alpha-value>)',
        brandDark:    'rgb(var(--brand-dark) / <alpha-value>)',
        brandSoft:    'rgb(var(--brand-soft) / <alpha-value>)',
        brandText:    'rgb(var(--brand-text) / <alpha-value>)',
        ok:           'rgb(var(--ok) / <alpha-value>)',
        p0:           'rgb(var(--p0) / <alpha-value>)',
        p1:           'rgb(var(--p1) / <alpha-value>)',
        p2:           'rgb(var(--p2) / <alpha-value>)',
        p3:           'rgb(var(--p3) / <alpha-value>)',
      },
      fontFamily: {
        // Mesmas famílias do app: Baloo 2 pra títulos/UI/números, Nunito pro texto.
        sans:    ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Baloo 2"', 'Nunito', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
