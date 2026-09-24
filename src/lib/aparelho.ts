/**
 * Aparelho, versão e canal de um aluno — montado a partir de três fontes, na
 * ordem de confiança:
 *   1. public.user_devices (migration 100): o app grava ao abrir, pra todo mundo
 *   2. public.push_tokens: só quem aceitou notificação; traz plataforma e versão
 *   3. support.tickets: o contexto do aparelho anexado ao último ticket
 *
 * Quem ainda não abriu a versão que grava user_devices aparece com o que as
 * fontes 2 e 3 sabem, marcado como "estimado".
 */

export type UserDevice = {
  user_id: string
  platform: string
  os_version: string | null
  device_model: string | null
  device_id: string | null
  device_name: string | null
  app_version: string | null
  build: string | null
  runtime_version: string | null
  canal: 'beta' | 'loja' | 'dev'
  updates_channel: string | null
  first_seen_at: string
  updated_at: string
}

export type PushTokenLite = { user_id: string; platform: string | null; app_version: string | null; updated_at: string | null }

export type TicketDevice = {
  user_id: string | null
  created_at: string
  platform?: string | null
  os_version?: string | null
  device_model?: string | null
  app_version?: string | null
}

export type Aparelho = {
  /** "iPhone 13" · "Samsung SM-A155M" · "iPhone" quando só sabemos a família */
  modelo: string | null
  /** "iOS 18.2" · "Android 14" */
  sistema: string | null
  /** "1.2.5 (42)" */
  versao: string | null
  /** Beta (TestFlight/APK) · App Store · Play Store · Expo Go */
  canal: string | null
  /** Rótulo curto pro chip: beta | loja | dev */
  canalKey: 'beta' | 'loja' | 'dev' | null
  /** Nome que a pessoa deu ao aparelho ("iPhone da Ana"), se diferente do modelo */
  apelido: string | null
  /** Quando foi visto por último (ISO) */
  vistoEm: string | null
  /** De onde veio a informação */
  fonte: 'app' | 'push' | 'ticket' | null
}

/** Telefone do banco ("+5538992667095") → "+55 38 99266-7095". Fora do padrão, devolve como veio. */
export function formatarTelefone(t: string | null | undefined): string | null {
  if (!t) return null
  const d = t.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55')) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`
  if (d.length === 12 && d.startsWith('55')) return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`
  if (d.length === 11) return `${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`
  return t
}

/** Só dígitos, pra montar link wa.me. */
export function telefoneDigitos(t: string | null | undefined): string | null {
  if (!t) return null
  const d = t.replace(/\D/g, '')
  return d.length >= 10 ? d : null
}

/** Identificador Apple → nome comercial. Só os que aparecem no público do Duka; o resto mostra o identificador. */
const IPHONE: Record<string, string> = {
  'iPhone10,1': 'iPhone 8', 'iPhone10,4': 'iPhone 8', 'iPhone10,2': 'iPhone 8 Plus', 'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X', 'iPhone10,6': 'iPhone X',
  'iPhone11,2': 'iPhone XS', 'iPhone11,4': 'iPhone XS Max', 'iPhone11,6': 'iPhone XS Max', 'iPhone11,8': 'iPhone XR',
  'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro', 'iPhone12,5': 'iPhone 11 Pro Max', 'iPhone12,8': 'iPhone SE (2ª ger.)',
  'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12', 'iPhone13,3': 'iPhone 12 Pro', 'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13', 'iPhone14,2': 'iPhone 13 Pro', 'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,6': 'iPhone SE (3ª ger.)', 'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max', 'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,1': 'iPhone 16 Pro', 'iPhone17,2': 'iPhone 16 Pro Max', 'iPhone17,3': 'iPhone 16', 'iPhone17,4': 'iPhone 16 Plus', 'iPhone17,5': 'iPhone 16e',
  'iPhone18,1': 'iPhone 17 Pro', 'iPhone18,2': 'iPhone 17 Pro Max', 'iPhone18,3': 'iPhone 17', 'iPhone18,4': 'iPhone Air',
}

/** API level do Android → versão comercial. */
const ANDROID: Record<string, string> = {
  '28': '9', '29': '10', '30': '11', '31': '12', '32': '12', '33': '13', '34': '14', '35': '15', '36': '16', '37': '17',
}

/** Prefixos de modelo Samsung/Xiaomi/Motorola que o Android devolve cru. */
function modeloAndroid(raw: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (/^SM-/i.test(s)) return `Samsung ${s}`
  if (/^moto/i.test(s)) return `Motorola ${s}`
  return s
}

function sistemaDe(platform: string | null, os: string | null): string | null {
  if (!platform) return null
  if (platform === 'ios') return os ? `iOS ${os}` : 'iOS'
  if (platform === 'android') {
    if (!os) return 'Android'
    // Vem como API level ("34") ou já como versão ("14")
    const v = ANDROID[os] ?? os
    return `Android ${v}${ANDROID[os] ? ` (API ${os})` : ''}`
  }
  return platform
}

export const CANAL_APARELHO: Record<'beta' | 'loja' | 'dev', string> = {
  beta: 'Beta (TestFlight / APK)',
  loja: 'Loja (App Store / Play Store)',
  dev:  'Expo Go / desenvolvimento',
}

export function montarAparelho(
  dev: UserDevice | null | undefined,
  push: PushTokenLite | null | undefined,
  tickets: TicketDevice[],
): Aparelho | null {
  if (dev) {
    let modelo: string | null = null
    if (dev.platform === 'ios') {
      modelo = (dev.device_id && IPHONE[dev.device_id]) || dev.device_model || dev.device_id || 'iPhone'
    } else {
      modelo = modeloAndroid(dev.device_model) ?? modeloAndroid(dev.device_id)
    }
    const apelido = dev.device_name && dev.device_name !== modelo && !/^iphone$/i.test(dev.device_name) ? dev.device_name : null
    const canal = dev.canal === 'loja'
      ? (dev.platform === 'ios' ? 'App Store' : dev.platform === 'android' ? 'Play Store' : CANAL_APARELHO.loja)
      : CANAL_APARELHO[dev.canal]
    return {
      modelo,
      sistema: sistemaDe(dev.platform, dev.os_version),
      versao: dev.app_version ? `${dev.app_version}${dev.build ? ` (${dev.build})` : ''}` : null,
      canal, canalKey: dev.canal, apelido,
      vistoEm: dev.updated_at, fonte: 'app',
    }
  }

  // Sem user_devices: junta o que push e tickets sabem (o mais recente ganha).
  const tk = tickets
    .filter((t) => t.device_model || t.platform || t.app_version)
    .sort((x, y) => y.created_at.localeCompare(x.created_at))[0] ?? null
  if (!push && !tk) return null

  const platform = tk?.platform ?? push?.platform ?? null
  const modelo = platform === 'android' ? modeloAndroid(tk?.device_model ?? null) : (tk?.device_model ?? (platform === 'ios' ? 'iPhone' : null))
  // Versão: a mais nova entre as duas fontes (push atualiza a cada abertura com permissão).
  const versoes = [push?.app_version, tk?.app_version].filter((v): v is string => !!v)
  const versao = versoes.sort((a, b) => cmpVersao(b, a))[0] ?? null
  const vistoEm = [push?.updated_at, tk?.created_at].filter((v): v is string => !!v).sort().reverse()[0] ?? null
  return {
    modelo,
    sistema: sistemaDe(platform, tk?.os_version ?? null),
    versao,
    canal: null, canalKey: null, apelido: null,
    vistoEm,
    fonte: tk && (!push || (tk.created_at > (push.updated_at ?? ''))) ? 'ticket' : 'push',
  }
}

function cmpVersao(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}
