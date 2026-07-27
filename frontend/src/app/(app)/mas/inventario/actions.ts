'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { UnidadMedida, HistorialPrecioItem } from './page'
import { mapHistorialRow } from './mappers'

type Err = { error: string }

// ─── Insumos ──────────────────────────────────────────────────────────────────
// stock_actual NUNCA se edita aquí — solo lo actualizan las funciones de
// inventario (ej. registrar_compra) vía movimientos_inventario.

export async function crearInsumo(data: {
  nombre: string
  unidadMedida: UnidadMedida
  stockMinimo: number
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: insumo, error } = await supabase
    .from('insumos')
    .insert({
      nombre: data.nombre,
      unidad_medida: data.unidadMedida,
      stock_minimo: data.stockMinimo,
    })
    .select('id')
    .single()
  if (error || !insumo) return { error: 'Error al crear el insumo.' }
  revalidatePath('/mas/inventario')
  return { id: insumo.id }
}

export async function actualizarInsumo(
  id: number,
  patch: { nombre: string; unidadMedida: UnidadMedida; stockMinimo: number },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('insumos')
    .update({
      nombre: patch.nombre,
      unidad_medida: patch.unidadMedida,
      stock_minimo: patch.stockMinimo,
    })
    .eq('id', id)
  if (error) return { error: 'Error al actualizar el insumo.' }
  revalidatePath('/mas/inventario')
}

export async function eliminarInsumo(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase.from('insumos').update({ activo: false }).eq('id', id)
  if (error) return { error: 'Error al eliminar el insumo.' }
  revalidatePath('/mas/inventario')
}

// ─── Proveedores ────────────────────────────────────────────────────────────

export async function crearProveedor(data: {
  nombre: string
  telefono: string | null
  contacto: string | null
  notas: string | null
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: proveedor, error } = await supabase
    .from('proveedores')
    .insert({
      nombre: data.nombre,
      telefono: data.telefono,
      contacto: data.contacto,
      notas: data.notas,
    })
    .select('id')
    .single()
  if (error || !proveedor) return { error: 'Error al crear el proveedor.' }
  revalidatePath('/mas/inventario')
  return { id: proveedor.id }
}

export async function actualizarProveedor(
  id: number,
  patch: { nombre: string; telefono: string | null; contacto: string | null; notas: string | null },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('proveedores')
    .update({
      nombre: patch.nombre,
      telefono: patch.telefono,
      contacto: patch.contacto,
      notas: patch.notas,
    })
    .eq('id', id)
  if (error) return { error: 'Error al actualizar el proveedor.' }
  revalidatePath('/mas/inventario')
}

export async function eliminarProveedor(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase.from('proveedores').update({ activo: false }).eq('id', id)
  if (error) return { error: 'Error al eliminar el proveedor.' }
  revalidatePath('/mas/inventario')
}

// ─── Compras ────────────────────────────────────────────────────────────────
// El único punto de escritura de movimientos_inventario es la función SQL
// registrar_compra() (SECURITY DEFINER, valida es_admin() internamente).

export async function registrarCompra(data: {
  proveedorId: number
  fecha: string
  numeroNota: string | null
  items: { insumoId: number; cantidad: number; costoUnitario: number }[]
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: compraId, error } = await supabase.rpc('registrar_compra', {
    p_proveedor_id: data.proveedorId,
    p_fecha: data.fecha,
    p_numero_nota: data.numeroNota,
    p_items: data.items.map((it) => ({
      insumo_id: it.insumoId,
      cantidad: it.cantidad,
      costo_unitario: it.costoUnitario,
    })),
  })
  if (error) return { error: error.message || 'Error al registrar la compra.' }
  revalidatePath('/mas/inventario')
  return { id: compraId as number }
}

export async function obtenerHistorialCompras(
  proveedorId: number | null,
): Promise<HistorialPrecioItem[] | Err> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('historial_precios_compras', {
    p_proveedor_id: proveedorId,
    p_limit: 100,
  })
  if (error) return { error: 'Error al cargar el historial de compras.' }
  return (data ?? []).map(mapHistorialRow)
}
