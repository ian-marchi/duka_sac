import { redirect } from 'next/navigation'

// O ticket passou a abrir na mesa de tickets (desenho F), na coluna da direita.
// Links antigos (/t/123, e-mails do Resend, notas do Obsidian) continuam valendo.
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/tickets?t=${encodeURIComponent(id)}`)
}
