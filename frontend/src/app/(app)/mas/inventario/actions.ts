'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { UnidadMedida, HistorialPrecioItem, ModoObtencionInsumo } from './page'
import { mapHistorialRow } from './mappers'

type Err = { error: string }

// ─── Insumos ──────────────────────────────────────────────────────────────────
// stock_actual NUNCA se edita aquí — solo lo actualizan las funciones de
// inventario (ej. registrar_compra) vía movimientos_inventario.

export async function crearInsumo(data: {
  nombre: string
  unidadMedida: UnidadMedida
  stockMinimo: number
  modoObtencion?: ModoObtencionInsumo
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: insumo, error } = await supabase
    .from('insumos')
    .insert({
      nombre: data.nombre,
      unidad_medida: data.unidadMedida,
      stock_minimo: data.stockMinimo,
      modo_obtencion: data.modoObtencion ?? 'comprado',
    })
    .select('id')
    .single()
  if (error || !insumo) return { error: 'Error al crear el insumo.' }
  revalidatePath('/mas/inventario')
  return { id: insumo.id }
}

export async function actualizarInsumo(
  id: number,
  patch: { nombre: string; unidadMedida: UnidadMedida; stockMinimo: number; modoObtencion: ModoObtencionInsumo },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('insumos')
    .update({
      nombre: patch.nombre,
      unidad_medida: patch.unidadMedida,
      stock_minimo: patch.stockMinimo,
      modo_obtencion: patch.modoObtencion,
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

// ─── Insumo derivado: receta de componentes (Nivel 1) ──────────────────────
// insumo_receta: qué insumos componentes (crudos u otros derivados) lleva un
// insumo derivado y en qué cantidad — mismo patrón que receta_insumos, un
// nivel abajo (insumo → insumo en vez de producto → insumo).

export type InsumoRecetaLinea = {
  id: number
  insumoComponenteId: number
  insumoComponenteNombre: string
  cantidad_usada: number
  unidad_medida: UnidadMedida
}

export async function cargarInsumoReceta(
  insumoId: number,
): Promise<{ lineas: InsumoRecetaLinea[] } | Err> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumo_receta')
    .select(
      'id, insumo_componente_id, cantidad_usada, unidad_medida, insumos!insumo_receta_insumo_componente_id_fkey(nombre)',
    )
    .eq('insumo_id', insumoId)
  if (error) return { error: 'Error al cargar la receta del insumo.' }
  return {
    lineas: (data ?? []).map((r: any) => ({
      id: r.id,
      insumoComponenteId: r.insumo_componente_id,
      insumoComponenteNombre: r.insumos?.nombre ?? '',
      cantidad_usada: r.cantidad_usada,
      unidad_medida: r.unidad_medida,
    })),
  }
}

export async function guardarInsumoReceta(
  insumoId: number,
  items: { insumoComponenteId: number; cantidad_usada: number; unidad_medida: UnidadMedida }[],
): Promise<Err | undefined> {
  const supabase = await createClient()

  if (items.some((i) => i.insumoComponenteId === insumoId)) {
    return { error: 'Un insumo no puede incluirse a sí mismo como componente.' }
  }

  const { error: errDelete } = await supabase
    .from('insumo_receta')
    .delete()
    .eq('insumo_id', insumoId)
  if (errDelete) return { error: 'Error al actualizar la receta del insumo.' }

  if (items.length > 0) {
    const { error: errInsert } = await supabase.from('insumo_receta').insert(
      items.map((i) => ({
        insumo_id: insumoId,
        insumo_componente_id: i.insumoComponenteId,
        cantidad_usada: i.cantidad_usada,
        unidad_medida: i.unidad_medida,
      })),
    )
    if (errInsert) return { error: 'Error al guardar la receta del insumo.' }
  }

  revalidatePath('/mas/inventario')
}

// ─── Registrar producción de un insumo derivado ────────────────────────────

export type ResultadoProduccion = {
  produccionId: number
  rendimientoReal: number | null
  rendimientoEsperado: number | null
  diferenciaPct: number | null
}

export async function registrarProduccionInsumo(data: {
  insumoId: number
  cantidadLote: number
  cantidadObtenida: number
  notas: string | null
}): Promise<{ resultado: ResultadoProduccion } | Err> {
  const supabase = await createClient()
  const { data: rows, error } = await supabase.rpc('registrar_produccion', {
    p_insumo_id: data.insumoId,
    p_cantidad_lote: data.cantidadLote,
    p_cantidad_obtenida: data.cantidadObtenida,
    p_notas: data.notas,
  })
  if (error) return { error: error.message || 'Error al registrar la producción.' }
  const r = (rows ?? [])[0] as
    | {
        produccion_id: number
        rendimiento_real: number | null
        rendimiento_esperado: number | null
        diferencia_pct: number | null
      }
    | undefined
  if (!r) return { error: 'No se pudo registrar la producción.' }

  revalidatePath('/mas/inventario')
  revalidatePath('/dashboard')
  return {
    resultado: {
      produccionId: r.produccion_id,
      rendimientoReal: r.rendimiento_real,
      rendimientoEsperado: r.rendimiento_esperado,
      diferenciaPct: r.diferencia_pct,
    },
  }
}
