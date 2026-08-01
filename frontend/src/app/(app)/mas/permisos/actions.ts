'use server'

import { createClient } from '@/lib/supabase/server'

type Err = { error: string }

export async function actualizarPermiso(
  campo: string,
  valor: boolean,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ [campo]: valor })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el permiso.' }
}

export async function actualizarBanco(patch: {
  transferencia_banco?: string | null
  transferencia_clabe?: string | null
  transferencia_titular?: string | null
}): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update(patch)
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los datos bancarios.' }
}

export async function actualizarPropina(
  pct: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ propina_sugerida_pct: pct })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar la propina.' }
}

export async function actualizarTimeoutInactividad(
  minutos: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ timeout_inactividad_minutos: minutos })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el tiempo de inactividad.' }
}

export async function actualizarModificadoresPorLinea(
  cantidad: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ modificadores_por_linea: cantidad })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los modificadores por línea.' }
}

export async function actualizarAlertaMesaMinutos(
  minutos: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ alerta_mesa_sin_atender_minutos: minutos })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los minutos de alerta.' }
}

type ModoOrden = 'alfabetico_asc' | 'alfabetico_desc' | 'personalizado'

export async function actualizarOrdenProductos(
  modo: ModoOrden,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ orden_productos: modo })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el orden de productos.' }
}

export async function actualizarOrdenModificadores(
  modo: ModoOrden,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ orden_modificadores: modo })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el orden de modificadores.' }
}
