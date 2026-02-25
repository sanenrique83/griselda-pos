'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Toggle global ────────────────────────────────────────────────────────────

export async function toggleImpresionGlobal(
  activa: boolean,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('config_sistema')
    .update({ impresion_activa: activa })
    .eq('id', 1)
  if (error) return { error: 'Error al actualizar la configuración global.' }
}

// ─── Impresoras ───────────────────────────────────────────────────────────────

export type ImpresoraUpdates = {
  activa?: boolean
  imprimir_recibos_cuentas?: boolean
  imprimir_pedidos?: boolean
  imprimir_automaticamente?: boolean
  un_articulo_por_ticket?: boolean
  agrupar_identicos?: boolean
  ancho_papel?: '58mm' | '80mm'
}

export async function crearImpresora(data: {
  nombre: string
  ip: string
  puerto: number
  ancho_papel: '58mm' | '80mm'
}): Promise<{ id: number } | { error: string }> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('impresoras')
    .insert({
      nombre: data.nombre,
      ip: data.ip,
      puerto: data.puerto,
      ancho_papel: data.ancho_papel,
      activa: true,
      imprimir_recibos_cuentas: true,
      imprimir_pedidos: true,
      imprimir_automaticamente: false,
      un_articulo_por_ticket: false,
      agrupar_identicos: true,
    })
    .select('id')
    .single()
  if (error) return { error: 'Error al crear la impresora.' }
  return { id: row.id }
}

export async function actualizarImpresora(
  id: number,
  updates: ImpresoraUpdates & { nombre?: string; ip?: string; puerto?: number },
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('impresoras')
    .update(updates)
    .eq('id', id)
  if (error) return { error: 'Error al actualizar la impresora.' }
}

export async function eliminarImpresora(
  id: number,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  // Verificar si algún grupo la usa
  const { count } = await supabase
    .from('grupos_impresora')
    .select('id', { count: 'exact', head: true })
    .eq('impresora_id', id)
  if ((count ?? 0) > 0)
    return { error: 'Hay grupos lógicos usando esta impresora. Reasígnalos primero.' }
  const { error } = await supabase.from('impresoras').delete().eq('id', id)
  if (error) return { error: 'Error al eliminar la impresora.' }
}

// ─── Grupos lógicos ───────────────────────────────────────────────────────────

export async function crearGrupo(data: {
  nombre: string
  impresora_id: number
}): Promise<{ id: number } | { error: string }> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('grupos_impresora')
    .insert({ nombre: data.nombre, impresora_id: data.impresora_id, activo: true })
    .select('id')
    .single()
  if (error) return { error: 'Error al crear el grupo.' }
  return { id: row.id }
}

export async function actualizarGrupo(
  id: number,
  updates: { activo?: boolean; impresora_id?: number; nombre?: string },
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('grupos_impresora')
    .update(updates)
    .eq('id', id)
  if (error) return { error: 'Error al actualizar el grupo.' }
}

export async function eliminarGrupo(
  id: number,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  // Liberar categorías asignadas
  await supabase
    .from('categorias')
    .update({ grupo_impresora_id: null })
    .eq('grupo_impresora_id', id)
  const { error } = await supabase.from('grupos_impresora').delete().eq('id', id)
  if (error) return { error: 'Error al eliminar el grupo.' }
}

// ─── Asignación de categorías a grupo ────────────────────────────────────────

export async function asignarCategoriasGrupo(
  grupoId: number,
  categoriaIds: number[],
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  // 1. Desasignar las que ya no están seleccionadas para este grupo
  const { error: e1 } = await supabase
    .from('categorias')
    .update({ grupo_impresora_id: null })
    .eq('grupo_impresora_id', grupoId)
    .not('id', 'in', categoriaIds.length > 0 ? `(${categoriaIds.join(',')})` : '(0)')
  if (e1) return { error: 'Error al actualizar asignaciones.' }

  // 2. Asignar las seleccionadas
  if (categoriaIds.length > 0) {
    const { error: e2 } = await supabase
      .from('categorias')
      .update({ grupo_impresora_id: grupoId })
      .in('id', categoriaIds)
    if (e2) return { error: 'Error al asignar categorías.' }
  }
}
