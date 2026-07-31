'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// toggleDisponible vive en mas/catalogo/actions.ts — MenuDelDiaShell la
// importa de ahí directamente (ver ese archivo), para no tener dos copias
// de la misma lógica divergiendo entre sí.

export async function setTodosDisponibles(): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('productos')
    .update({ disponible: true })
    .eq('activo', true)

  if (error) return { error: 'Error al actualizar los productos.' }

  revalidatePath('/mas/menu-del-dia')
  return {}
}
