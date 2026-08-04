import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TicketConfigShell } from '@/components/config/TicketConfigShell'
import type { TicketConfig } from '@/lib/print'

export default async function ConfiguracionPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'admin') redirect('/mas')

  const { data: config } = await supabase
    .from('config_sistema')
    .select(
      'ticket_nombre, ticket_direccion, ticket_telefono, ticket_rfc, ticket_linea1, ticket_linea2, ticket_pie, ticket_pie2, modificadores_por_linea, formato_modificadores_ticket',
    )
    .eq('id', 1)
    .single()

  const ticketConfig: TicketConfig = {
    nombre: (config as any)?.ticket_nombre ?? 'La Menuderia',
    direccion: (config as any)?.ticket_direccion ?? '',
    telefono: (config as any)?.ticket_telefono ?? '',
    rfc: (config as any)?.ticket_rfc ?? '',
    linea1: (config as any)?.ticket_linea1 ?? '',
    linea2: (config as any)?.ticket_linea2 ?? '',
    pie: (config as any)?.ticket_pie ?? 'Gracias por su visita!',
    pie2: (config as any)?.ticket_pie2 ?? '',
    modificadores_por_linea: (config as any)?.modificadores_por_linea ?? 1,
    formato_modificadores_ticket: (config as any)?.formato_modificadores_ticket ?? 'agrupado',
  }

  return <TicketConfigShell initialConfig={ticketConfig} />
}
