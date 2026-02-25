'use server'

import { createClient } from '@/lib/supabase/server'

type Err = { error: string }

// ─── Áreas ────────────────────────────────────────────────────────────────────

export async function crearArea(nombre: string): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('areas')
    .insert({ nombre, orden: 99 })
    .select('id')
    .single()
  if (error || !data) return { error: 'Error al crear el área.' }
  return { id: data.id }
}

export async function actualizarArea(
  id: number,
  nombre: string,
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('areas')
    .update({ nombre })
    .eq('id', id)
  if (error) return { error: 'Error al actualizar el área.' }
}

export async function eliminarArea(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  // Verificar sin mesas activas
  const { count } = await supabase
    .from('mesas')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', id)
    .eq('activa', true)
  if ((count ?? 0) > 0) return { error: 'El área tiene mesas activas.' }
  const { error } = await supabase.from('areas').update({ activa: false }).eq('id', id)
  if (error) return { error: 'Error al eliminar el área.' }
}

// ─── Mesas ────────────────────────────────────────────────────────────────────

export async function crearMesa(data: {
  areaId: number
  numero: number
  nombre?: string | null
  capacidad?: number | null
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: mesa, error } = await supabase
    .from('mesas')
    .insert({
      area_id: data.areaId,
      numero: data.numero,
      nombre: data.nombre ?? null,
      capacidad: data.capacidad ?? null,
    })
    .select('id')
    .single()
  if (error || !mesa) return { error: 'Error al crear la mesa.' }
  return { id: mesa.id }
}

export async function actualizarMesa(
  id: number,
  patch: {
    numero?: number
    nombre?: string | null
    capacidad?: number | null
  },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase.from('mesas').update(patch).eq('id', id)
  if (error) return { error: 'Error al actualizar la mesa.' }
}

export async function eliminarMesa(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  // Verificar sin pedidos abiertos
  const { count } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('mesa_id', id)
    .eq('estado', 'abierto')
  if ((count ?? 0) > 0) return { error: 'La mesa tiene pedidos activos.' }
  const { error } = await supabase.from('mesas').update({ activa: false }).eq('id', id)
  if (error) return { error: 'Error al eliminar la mesa.' }
}

// ─── Categorías ───────────────────────────────────────────────────────────────

export async function crearCategoria(data: {
  nombre: string
  orden?: number
  modo_captura?: 'estandar' | 'rapido'
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: cat, error } = await supabase
    .from('categorias')
    .insert({
      nombre: data.nombre,
      orden: data.orden ?? 99,
      modo_captura: data.modo_captura ?? 'estandar',
      activa: true,
    })
    .select('id')
    .single()
  if (error || !cat) return { error: 'Error al crear la categoría.' }
  return { id: cat.id }
}

export async function actualizarCategoria(
  id: number,
  patch: { nombre?: string; orden?: number; modo_captura?: 'estandar' | 'rapido' },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase.from('categorias').update(patch).eq('id', id)
  if (error) return { error: 'Error al actualizar la categoría.' }
}

export async function eliminarCategoria(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', id)
    .eq('activo', true)
  if ((count ?? 0) > 0) return { error: 'La categoría tiene productos activos.' }
  const { error } = await supabase
    .from('categorias')
    .update({ activa: false })
    .eq('id', id)
  if (error) return { error: 'Error al eliminar la categoría.' }
}

// ─── Productos ────────────────────────────────────────────────────────────────

export async function subirImagenProducto(
  formData: FormData,
): Promise<{ url: string } | Err> {
  const supabase = await createClient()
  const file = formData.get('file') as File | null
  if (!file) return { error: 'No se seleccionó imagen.' }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('productos')
    .upload(path, file, { upsert: false })
  if (error) return { error: 'Error al subir la imagen. Verifica que el bucket "productos" exista.' }
  const { data: urlData } = supabase.storage.from('productos').getPublicUrl(path)
  return { url: urlData.publicUrl }
}

export async function crearProducto(data: {
  nombre: string
  precio: number
  categoriaId: number
  descripcion?: string | null
  emoji?: string | null
  foto_url?: string | null
  modo_captura?: 'estandar' | 'rapido'
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: prod, error } = await supabase
    .from('productos')
    .insert({
      nombre: data.nombre,
      precio: data.precio,
      categoria_id: data.categoriaId,
      descripcion: data.descripcion ?? null,
      emoji: data.emoji ?? null,
      foto_url: data.foto_url ?? null,
      modo_captura: data.modo_captura ?? 'estandar',
      activo: true,
      disponible: true,
    })
    .select('id')
    .single()
  if (error || !prod) return { error: 'Error al crear el producto.' }
  return { id: prod.id }
}

export async function actualizarProducto(
  id: number,
  patch: {
    nombre?: string
    precio?: number
    descripcion?: string | null
    emoji?: string | null
    foto_url?: string | null
    categoria_id?: number
    modo_captura?: 'estandar' | 'rapido'
  },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update(patch).eq('id', id)
  if (error) return { error: 'Error al actualizar el producto.' }
}

export async function eliminarProducto(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('productos')
    .update({ activo: false })
    .eq('id', id)
  if (error) return { error: 'Error al eliminar el producto.' }
}

export async function toggleDisponible(
  id: number,
  disponible: boolean,
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('productos')
    .update({
      disponible,
      disponible_actualizado_en: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: 'Error al actualizar disponibilidad.' }
}

// ─── Grupos modificadores ─────────────────────────────────────────────────────

export async function crearGrupoModificador(data: {
  productoId: number
  nombre: string
  requerido?: boolean
  minimo?: number
  maximo?: number
  orden?: number
  mostrar_en_rapido?: boolean
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: grupo, error } = await supabase
    .from('grupos_modificadores')
    .insert({
      producto_id: data.productoId,
      nombre: data.nombre,
      requerido: data.requerido ?? false,
      minimo: data.minimo ?? 0,
      maximo: data.maximo ?? 1,
      orden: data.orden ?? 99,
      mostrar_en_rapido: data.mostrar_en_rapido ?? false,
    })
    .select('id')
    .single()
  if (error || !grupo) return { error: 'Error al crear el grupo.' }
  return { id: grupo.id }
}

export async function actualizarGrupoModificador(
  id: number,
  patch: {
    nombre?: string
    requerido?: boolean
    minimo?: number
    maximo?: number
    orden?: number
    mostrar_en_rapido?: boolean
  },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('grupos_modificadores')
    .update(patch)
    .eq('id', id)
  if (error) return { error: 'Error al actualizar el grupo.' }
}

export async function eliminarGrupoModificador(
  id: number,
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('grupos_modificadores')
    .delete()
    .eq('id', id)
  if (error) return { error: 'Error al eliminar el grupo.' }
}

// ─── Opciones modificadores ───────────────────────────────────────────────────

export async function crearOpcion(data: {
  grupoId: number
  nombre: string
  precio_extra?: number
  orden?: number
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: op, error } = await supabase
    .from('opciones_modificador')
    .insert({
      grupo_id: data.grupoId,
      nombre: data.nombre,
      precio_extra: data.precio_extra ?? 0,
      orden: data.orden ?? 99,
    })
    .select('id')
    .single()
  if (error || !op) return { error: 'Error al crear la opción.' }
  return { id: op.id }
}

export async function actualizarOpcion(
  id: number,
  patch: { nombre?: string; precio_extra?: number; orden?: number },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('opciones_modificador')
    .update(patch)
    .eq('id', id)
  if (error) return { error: 'Error al actualizar la opción.' }
}

export async function eliminarOpcion(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('opciones_modificador')
    .update({ activa: false })
    .eq('id', id)
  if (error) return { error: 'Error al eliminar la opción.' }
}
