'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

export type CambioMesa = {
  id: number
  posX: number
  posY: number
  rotacion: number
  forma: FormaMesa
  tamano: TamanoMesa
  // Opcional: PlanoMesas.tsx (auto-guardado de posición en /mesas) no manda
  // este campo — solo el editor de /mas/mapa-mesas lo trae, para no pisar
  // el valor existente cuando no se está editando el toggle.
  fueraDeServicio?: boolean
}

export async function guardarDisposicion(
  cambios: CambioMesa[],
): Promise<{ error: string } | { ok: true }> {
  if (cambios.length === 0) return { ok: true }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  const resultados = await Promise.all(
    cambios.map((c) => {
      const patch: {
        pos_x: number
        pos_y: number
        rotacion: number
        forma: FormaMesa
        tamano: TamanoMesa
        fuera_de_servicio?: boolean
      } = {
        pos_x: c.posX,
        pos_y: c.posY,
        rotacion: c.rotacion,
        forma: c.forma,
        tamano: c.tamano,
      }
      if (c.fueraDeServicio !== undefined) patch.fuera_de_servicio = c.fueraDeServicio
      return supabase.from('mesas').update(patch).eq('id', c.id)
    }),
  )

  if (resultados.some((r) => r.error)) {
    return { error: 'Error al guardar la disposición.' }
  }

  revalidatePath('/mas/mapa-mesas')
  revalidatePath('/mesas')
  return { ok: true }
}
