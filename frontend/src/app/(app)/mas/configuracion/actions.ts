'use server'

import { createClient } from '@/lib/supabase/server'
import type { TicketConfig } from '@/lib/print'

export async function guardarConfigTicket(
  data: TicketConfig,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('config_sistema')
    .update({
      ticket_nombre: data.nombre.trim() || 'La Menuderia',
      ticket_direccion: data.direccion.trim(),
      ticket_telefono: data.telefono.trim(),
      ticket_rfc: data.rfc.trim(),
      ticket_linea1: data.linea1.trim(),
      ticket_linea2: data.linea2.trim(),
      ticket_pie: data.pie.trim() || 'Gracias por su visita!',
      ticket_pie2: data.pie2.trim(),
    })
    .eq('id', 1)
  if (error) return { error: 'Error al guardar la configuración del ticket.' }
}
