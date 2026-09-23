// Tipos do domínio de tickets — espelham o schema `support` do Supabase.

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

export type TicketStatus =
  | 'new' | 'triage' | 'open' | 'waiting_user'
  | 'resolved' | 'wont_fix' | 'duplicate' | 'archived'

export type TicketSource =
  | 'user' | 'crash' | 'api_error' | 'media_error' | 'performance' | 'nps'

export type TicketKind =
  | 'bug' | 'complaint' | 'idea' | 'question'
  | 'question_report' | 'ai_report' | 'abuse' | 'billing' | 'auth'
  | 'crash' | 'api_error' | 'media_error' | 'performance' | 'nps'

export type Ticket = {
  id: number
  ref: string
  source: TicketSource
  kind: TicketKind
  status: TicketStatus
  priority: Priority
  priority_source: 'rule' | 'manual'
  priority_reason: string[]
  fingerprint: string | null
  occurrences: number
  affected_users: number
  duplicate_of: number | null
  title: string
  message: string
  user_id: string | null
  reporter_name: string | null
  reporter_email: string | null
  was_premium: boolean
  app_version: string | null
  build: string | null
  runtime_version: string | null
  platform: 'android' | 'ios' | 'web' | null
  os_version: string | null
  device_model: string | null
  route: string | null
  locale: string | null
  error_message: string | null
  error_stack: string | null
  sentry_event_id: string | null
  context: Record<string, unknown>
  internal_note: string | null
  tags: string[]
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type TicketEvent = {
  id: number
  ticket_id: number
  actor: string
  type: string
  from_value: string | null
  to_value: string | null
  body: string | null
  created_at: string
}

export type TicketReply = {
  id: number
  ticket_id: number
  to_email: string
  subject: string
  body: string
  sent_by: string
  provider_id: string | null
  send_status: 'queued' | 'sent' | 'failed'
  error: string | null
  created_at: string
}

export type ReplyTemplate = {
  id: string
  label: string
  subject: string
  body: string
  kind: string[]
}

// support.whatsapp_templates / whatsapp_outbox (088 + 091) ─────────────────
export type WhatsappTemplate = { chave: string; corpo: string }

export type WhatsappOutboxStatus = 'queued' | 'sent' | 'failed' | 'skipped' | 'draft'

export type PriorityRule = {
  id: string
  enabled: boolean
  weight: number
  priority: Priority
  match_kind: string[] | null
  match_words: string[] | null
  min_users: number | null
  min_occurs: number | null
  premium_only: boolean
  description: string
}

// Rótulos PT-BR e metadados de exibição ─────────────────────────────────────

export const PRIORITY_LABEL: Record<Priority, string> = {
  P0: 'Crítico', P1: 'Alto', P2: 'Médio', P3: 'Baixo',
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'Novo', triage: 'Triagem', open: 'Aberto', waiting_user: 'Aguardando',
  resolved: 'Resolvido', wont_fix: 'Não farei', duplicate: 'Duplicado', archived: 'Arquivado',
}

export const KIND_META: Record<TicketKind, { label: string; icon: string }> = {
  crash:           { label: 'Crash',       icon: '💥' },
  api_error:       { label: 'API',         icon: '🔌' },
  media_error:     { label: 'Mídia',       icon: '🖼️' },
  performance:     { label: 'Lentidão',    icon: '⏱️' },
  bug:             { label: 'Bug',         icon: '🐛' },
  complaint:       { label: 'Reclamação',  icon: '💬' },
  idea:            { label: 'Sugestão',    icon: '💡' },
  question:        { label: 'Dúvida',      icon: '❓' },
  question_report: { label: 'Questão',     icon: '🚩' },
  ai_report:       { label: 'IA',          icon: '🤖' },
  abuse:           { label: 'Abuso',       icon: '⚠️' },
  billing:         { label: 'Pagamento',   icon: '💳' },
  auth:            { label: 'Login',       icon: '🔐' },
  nps:             { label: 'Feedback',    icon: '📝' },
}

// ── Consumo de tokens de IA (views public.ai_usage_*, migration 047) ────────

export type AiUsageByUser = {
  user_id: string
  email: string | null
  username: string | null
  premium_status: string | null
  chamadas: number
  chamadas_com_erro: number
  tokens_total: number
  tokens_entrada: number
  tokens_saida: number
  tokens_hoje: number
  tokens_semana: number
  tokens_mes: number
  tokens_ano: number
  media_por_chamada: number
  ultima_chamada: string | null
}

export type AiUsageByFeature = {
  recurso: string
  model: string
  chamadas: number
  usuarios: number
  tokens_entrada: number
  tokens_saida: number
  tokens_total: number
  media_por_chamada: number
  tokens_mes: number
}

// Rótulos PT-BR das Edge Functions que gastam tokens.
export const FEATURE_LABEL: Record<string, string> = {
  'ai-chat': 'Chat Duka IA',
  'essay-correct': 'Correção de redação',
  'flashcards-generate': 'Geração de flashcards',
  'questions-generate': 'Geração de questões',
  'subject-plan-generate': 'Plano por matéria',
  'moderate-avatar': 'Moderação de avatar',
}

export const featureLabel = (f: string): string => FEATURE_LABEL[f] ?? f

// ── JARVIS: relatórios (support.reports, migration 081) ─────────────────────

export type ReportKind = 'usuarios' | 'erros' | 'tickets' | 'diario'

export type Report = {
  id: number
  kind: ReportKind
  period_days: number
  title: string
  summary: string
  body_md: string
  model: string | null
  tokens: number | null
  cost_usd: number | null
  generated_by: string
  synced_at: string | null
  spoken_at: string | null
  created_at: string
}

export const REPORT_KIND_META: Record<ReportKind, { label: string; icon: string; folder: string; days: number }> = {
  diario:   { label: 'Resumo diário', icon: '🌅', folder: 'Diário',   days: 1 },
  usuarios: { label: 'Usuários',      icon: '👥', folder: 'Usuários', days: 14 },
  erros:    { label: 'Erros',         icon: '💥', folder: 'Erros',    days: 7 },
  tickets:  { label: 'Tickets',       icon: '🎫', folder: 'Tickets',  days: 7 },
}

// ── Dashboard geral: linhas cruas de public.* ───────────────────────────────

export type AppUser = {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  premium_status: string | null
  total_points: number | null
  current_streak: number | null
  last_activity_date: string | null
  onboarding_completed: boolean | null
  target_exam: string | null
  target_course: string | null
  age: number | null
  school_type: string | null
  weekly_availability: Record<string, number[]> | null
  created_at: string
}

export type AppOpen = { user_id: string; dia: string; aberturas: number }

export type AiUsageRow = {
  user_id: string
  feature: string
  total_tokens: number
  ok: boolean
  cost_usd: number | null
  created_at: string
}

export const STATUS_GROUPS: { key: string; label: string; statuses: TicketStatus[] }[] = [
  { key: 'novos',      label: 'Novos',       statuses: ['new'] },
  { key: 'abertos',    label: 'Abertos',     statuses: ['triage', 'open'] },
  { key: 'aguardando', label: 'Aguardando',  statuses: ['waiting_user'] },
  { key: 'resolvidos', label: 'Resolvidos',  statuses: ['resolved', 'wont_fix', 'duplicate'] },
  { key: 'todos',      label: 'Todos',       statuses: [] },
]
