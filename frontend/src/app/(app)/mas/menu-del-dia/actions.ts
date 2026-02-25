'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleDisponible(
  productoId: number,
  disponible: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('productos')
    .update({ disponible })
    .eq('id', productoId)

  if (error) return { error: 'Error al actualizar el producto.' }

  revalidatePath('/mas/menu-del-dia')
  return {}
}

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
