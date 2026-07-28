'use server'

import { revalidatePath } from 'next/cache'
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
  es_combo?: boolean
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
      es_combo: data.es_combo ?? false,
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
    es_combo?: boolean
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
      activo: true,
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
    .update({ activo: false })
    .eq('id', id)
  if (error) return { error: 'Error al eliminar el grupo.' }
}

// ─── Opciones modificadores ───────────────────────────────────────────────────

export async function crearOpcion(data: {
  grupoId: number
  nombre: string
  precio_extra?: number
  orden?: number
  insumoId?: number | null
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: op, error } = await supabase
    .from('opciones_modificador')
    .insert({
      grupo_id: data.grupoId,
      nombre: data.nombre,
      precio_extra: data.precio_extra ?? 0,
      orden: data.orden ?? 99,
      insumo_id: data.insumoId ?? null,
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

// ─── Ingredientes ─────────────────────────────────────────────────────────────
// "Ingredientes" ya no es una tabla propia: es una vista simplificada sobre
// insumos (toggle disponible/agotado + selector para vincular una opción de
// modificador). Un ingrediente creado aquí es un insumo con valores por
// defecto ('pieza', sin stock ni costeo); si luego necesita receta propia o
// costeo real, se edita como cualquier otro insumo desde Inventario.

export async function crearIngrediente(
  nombre: string,
): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumos')
    .insert({
      nombre,
      unidad_medida: 'pieza',
      stock_actual: 0,
      stock_minimo: 0,
      modo_obtencion: 'comprado',
      disponible: true,
    })
    .select('id')
    .single()
  if (error || !data) return { error: 'Error al crear el ingrediente.' }
  revalidatePath('/mas/catalogo')
  return { id: data.id }
}

export async function actualizarIngrediente(
  id: number,
  nombre: string,
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('insumos')
    .update({ nombre })
    .eq('id', id)
  if (error) return { error: 'Error al actualizar el ingrediente.' }
  revalidatePath('/mas/catalogo')
}

export async function eliminarIngrediente(id: number): Promise<Err | undefined> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('opciones_modificador')
    .select('id', { count: 'exact', head: true })
    .eq('insumo_id', id)
    .eq('activa', true)
  if ((count ?? 0) > 0)
    return { error: 'Este ingrediente está en uso en opciones activas.' }
  // Soft delete: a diferencia de la vieja tabla ingredientes, un insumo
  // puede tener compras/receta_insumos/producciones dependientes — un DELETE
  // físico rompería esas referencias.
  const { error } = await supabase.from('insumos').update({ activo: false }).eq('id', id)
  if (error) return { error: 'Error al eliminar el ingrediente.' }
  revalidatePath('/mas/catalogo')
}

export async function toggleIngredienteDisponible(
  id: number,
  disponible: boolean,
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('insumos')
    .update({ disponible })
    .eq('id', id)
  if (error) return { error: 'Error al actualizar el ingrediente.' }
}

export async function setTodosIngredientesDisponibles(): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('insumos')
    .update({ disponible: true })
    .eq('activo', true)
  if (error) return { error: 'Error al actualizar ingredientes.' }
  revalidatePath('/mas/catalogo')
}

// ─── Receta ───────────────────────────────────────────────────────────────────
// Un producto normal (es_combo=FALSE) tiene a lo más una receta (recetas.producto_id
// es UNIQUE). Un combo no tiene fila en recetas — ver sección "Combo" más abajo.

type UnidadMedidaReceta = 'kg' | 'g' | 'l' | 'ml' | 'pieza' | 'paquete'

// modo_preparacion se elige desde la pantalla de Receta (selector de 3 vías):
// 'por_orden' se prepara al momento (Fase E), 'por_lote' se cocina en tandas y
// vende de un lote ya hecho (Fase F, ver porciones_disponibles/rendimiento_esperado
// abajo), 'reventa' es un artículo de reventa cuyo único insumo es él mismo
// (Fase G, souvenirs).
export type ModoPreparacionReceta = 'por_orden' | 'por_lote' | 'reventa'

export type RecetaData = {
  id: number
  nombre: string
  modo_preparacion: ModoPreparacionReceta
  rendimiento: string | null
  tiempo_prep_min: number | null
  instrucciones: string | null
  // Solo aplican con modo_preparacion='por_lote'.
  porciones_disponibles: number
  rendimiento_esperado: number | null
  insumos: {
    id: number
    insumoId: number
    insumoNombre: string
    unidad_medida: UnidadMedidaReceta
    cantidad_usada: number
  }[]
}

export async function cargarReceta(
  productoId: number,
): Promise<{ receta: RecetaData | null } | Err> {
  const supabase = await createClient()

  const { data: receta, error } = await supabase
    .from('recetas')
    .select(
      'id, nombre, modo_preparacion, rendimiento, tiempo_prep_min, instrucciones, porciones_disponibles, rendimiento_esperado',
    )
    .eq('producto_id', productoId)
    .maybeSingle()
  if (error) return { error: 'Error al cargar la receta.' }
  if (!receta) return { receta: null }

  const { data: insumosRows, error: errInsumos } = await supabase
    .from('receta_insumos')
    .select('id, insumo_id, cantidad_usada, unidad_medida, insumos(nombre)')
    .eq('receta_id', receta.id)
  if (errInsumos) return { error: 'Error al cargar los insumos de la receta.' }

  return {
    receta: {
      id: receta.id,
      nombre: receta.nombre,
      modo_preparacion: receta.modo_preparacion,
      rendimiento: receta.rendimiento ?? null,
      tiempo_prep_min: receta.tiempo_prep_min ?? null,
      instrucciones: receta.instrucciones ?? null,
      porciones_disponibles: receta.porciones_disponibles ?? 0,
      rendimiento_esperado: receta.rendimiento_esperado ?? null,
      insumos: (insumosRows ?? []).map((r: any) => ({
        id: r.id,
        insumoId: r.insumo_id,
        insumoNombre: r.insumos?.nombre ?? '',
        unidad_medida: r.unidad_medida,
        cantidad_usada: r.cantidad_usada,
      })),
    },
  }
}

export async function guardarReceta(
  productoId: number,
  data: {
    nombre: string
    modo_preparacion: ModoPreparacionReceta
    rendimiento: string | null
    tiempo_prep_min: number | null
    instrucciones: string | null
    // Solo se envían (y solo se persisten) cuando modo_preparacion='por_lote'.
    porciones_disponibles?: number
    rendimiento_esperado?: number | null
    insumos: {
      insumoId: number
      cantidad_usada: number
      unidad_medida: UnidadMedidaReceta
    }[]
  },
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: existente, error: errExistente } = await supabase
    .from('recetas')
    .select('id')
    .eq('producto_id', productoId)
    .maybeSingle()
  if (errExistente) return { error: 'Error al guardar la receta.' }

  // Reventa: el artículo mismo es el insumo — exactamente uno, cantidad 1.
  if (data.modo_preparacion === 'reventa') {
    if (data.insumos.length !== 1 || data.insumos[0].cantidad_usada !== 1) {
      return { error: 'Un producto de reventa debe tener exactamente un insumo con cantidad 1.' }
    }
  }

  let recetaId: number
  if (existente) {
    recetaId = existente.id
    const { error } = await supabase
      .from('recetas')
      .update({
        nombre: data.nombre,
        modo_preparacion: data.modo_preparacion,
        rendimiento: data.rendimiento,
        tiempo_prep_min: data.tiempo_prep_min,
        instrucciones: data.instrucciones,
        ...(data.porciones_disponibles !== undefined
          ? { porciones_disponibles: data.porciones_disponibles }
          : {}),
        ...(data.rendimiento_esperado !== undefined
          ? { rendimiento_esperado: data.rendimiento_esperado }
          : {}),
      })
      .eq('id', recetaId)
    if (error) return { error: 'Error al actualizar la receta.' }
  } else {
    const { data: nueva, error } = await supabase
      .from('recetas')
      .insert({
        producto_id: productoId,
        nombre: data.nombre,
        modo_preparacion: data.modo_preparacion,
        rendimiento: data.rendimiento,
        tiempo_prep_min: data.tiempo_prep_min,
        instrucciones: data.instrucciones,
        porciones_disponibles: data.porciones_disponibles ?? 0,
        rendimiento_esperado: data.rendimiento_esperado ?? null,
      })
      .select('id')
      .single()
    if (error || !nueva) return { error: 'Error al crear la receta.' }
    recetaId = nueva.id
  }

  const { error: errDelete } = await supabase
    .from('receta_insumos')
    .delete()
    .eq('receta_id', recetaId)
  if (errDelete) return { error: 'Error al actualizar los insumos de la receta.' }

  if (data.insumos.length > 0) {
    const { error: errInsert } = await supabase.from('receta_insumos').insert(
      data.insumos.map((i) => ({
        receta_id: recetaId,
        insumo_id: i.insumoId,
        cantidad_usada: i.cantidad_usada,
        unidad_medida: i.unidad_medida,
      })),
    )
    if (errInsert) return { error: 'Error al guardar los insumos de la receta.' }
  }

  revalidatePath('/mas/catalogo')
  revalidatePath('/mas/recetario')
  revalidatePath('/mas/inventario')
  revalidatePath('/dashboard')
}

// ─── Combo (componentes) ────────────────────────────────────────────────────
// combo_productos ya existía en el esquema inicial. Un combo se arma con
// productos componentes (normales, con su propia receta) y cantidades — no
// duplica insumos ni tiene su propia fila en recetas.

export type ComboComponenteData = {
  id: number
  productoId: number
  nombre: string
  precio: number
  cantidad: number
}

export async function cargarComboComponentes(
  comboId: number,
): Promise<{ componentes: ComboComponenteData[] } | Err> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('combo_productos')
    .select('id, producto_id, cantidad, productos!combo_productos_producto_id_fkey(nombre, precio)')
    .eq('combo_id', comboId)
  if (error) return { error: 'Error al cargar los componentes del combo.' }
  return {
    componentes: (data ?? []).map((c: any) => ({
      id: c.id,
      productoId: c.producto_id,
      nombre: c.productos?.nombre ?? '',
      precio: c.productos?.precio ?? 0,
      cantidad: c.cantidad,
    })),
  }
}

export async function guardarComboComponentes(
  comboId: number,
  items: { productoId: number; cantidad: number }[],
): Promise<Err | undefined> {
  const supabase = await createClient()

  if (items.some((i) => i.productoId === comboId)) {
    return { error: 'Un combo no puede incluirse a sí mismo como componente.' }
  }

  if (items.length > 0) {
    const { data: candidatos, error: errCandidatos } = await supabase
      .from('productos')
      .select('id, es_combo')
      .in('id', items.map((i) => i.productoId))
    if (errCandidatos) return { error: 'Error al validar los componentes.' }
    if ((candidatos ?? []).some((p) => p.es_combo)) {
      return { error: 'Un combo no puede incluir a otro combo como componente.' }
    }
  }

  const { error: errDelete } = await supabase
    .from('combo_productos')
    .delete()
    .eq('combo_id', comboId)
  if (errDelete) return { error: 'Error al actualizar los componentes del combo.' }

  if (items.length > 0) {
    const { error: errInsert } = await supabase.from('combo_productos').insert(
      items.map((i) => ({
        combo_id: comboId,
        producto_id: i.productoId,
        cantidad: i.cantidad,
      })),
    )
    if (errInsert) return { error: 'Error al guardar los componentes del combo.' }
  }

  revalidatePath('/mas/catalogo')
  revalidatePath('/mas/recetario')
  revalidatePath('/mas/inventario')
  revalidatePath('/dashboard')
}

// ─── Costeo ───────────────────────────────────────────────────────────────────
// Envuelven las funciones SQL costo_insumos_actual() y margen_productos()
// (migración 20260726000005) — el cálculo vive en la BD para que el costo de
// combo (suma de recetas de sus componentes) sea siempre consistente entre el
// editor de catálogo y el dashboard.

export async function obtenerCostosInsumos(): Promise<
  { costos: { insumoId: number; costoUnitario: number }[] } | Err
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('costo_insumos_actual')
  if (error) return { error: 'Error al calcular el costo de los insumos.' }
  return {
    costos: (data ?? []).map((r: any) => ({
      insumoId: r.insumo_id,
      costoUnitario: r.costo_unitario,
    })),
  }
}

export type MargenProducto = {
  productoId: number
  nombre: string
  esCombo: boolean
  precio: number
  costo: number | null
  costoCompleto: boolean
  margen: number | null
  margenPct: number | null
  // TRUE si algún insumo de la receta (o de algún componente, si es combo)
  // depende de la opción de modificador elegida — el costo/margen devueltos
  // son solo el "piso" con los insumos fijos, no un número exacto.
  margenVariable: boolean
}

export async function obtenerMargenProductos(): Promise<
  { margenes: MargenProducto[] } | Err
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('margen_productos')
  if (error) return { error: 'Error al calcular el margen de los productos.' }
  return {
    margenes: (data ?? []).map((r: any) => ({
      productoId: r.producto_id,
      nombre: r.nombre,
      esCombo: r.es_combo,
      precio: r.precio,
      costo: r.costo,
      costoCompleto: r.costo_completo,
      margen: r.margen,
      margenPct: r.margen_pct,
      margenVariable: r.margen_variable ?? false,
    })),
  }
}
