import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InventarioShell } from '@/components/inventario/InventarioShell'
import { mapHistorialRow } from './mappers'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type UnidadMedida = 'kg' | 'g' | 'l' | 'ml' | 'pieza' | 'paquete'

export type ModoObtencionInsumo = 'comprado' | 'derivado'

export type InsumoInventario = {
  id: number
  nombre: string
  unidad_medida: UnidadMedida
  stock_actual: number
  stock_minimo: number
  activo: boolean
  modo_obtencion: ModoObtencionInsumo
}

export type ProveedorInventario = {
  id: number
  nombre: string
  telefono: string | null
  contacto: string | null
  notas: string | null
  activo: boolean
}

export type HistorialPrecioItem = {
  compraId: number
  fecha: string
  numeroNota: string | null
  compraTotal: number
  proveedorId: number
  proveedorNombre: string
  insumoId: number
  insumoNombre: string
  unidadMedida: UnidadMedida
  cantidad: number
  costoUnitario: number
  costoUnitarioAnterior: number | null
  diferencia: number | null
}

// 'sin_receta': producto normal sin fila en recetas, o combo sin componentes.
// 'incompleta': tiene receta, pero algún grupo de modificadores requerido no
//   tiene ninguna opción con receta_insumos propia (opcion_id apuntando a
//   una de sus opciones) — la variante no está definida para esa opción.
// 'completa': todo lo demás.
export type EstadoReceta = 'sin_receta' | 'incompleta' | 'completa'

export type RecetaProductoItem = {
  productoId: number
  nombre: string
  esCombo: boolean
  estado: EstadoReceta
}

export type CategoriaConRecetas = {
  categoriaId: number
  categoriaNombre: string
  productos: RecetaProductoItem[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InventarioPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'admin') redirect('/mesas')

  const [
    { data: rawInsumos },
    { data: rawProveedores },
    { data: rawHistorial },
    { data: rawCategorias },
    { data: rawProductos },
    { data: rawRecetas },
    { data: rawRecetaInsumos },
    { data: rawComboProductos },
    { data: rawGrupos },
    { data: rawOpciones },
  ] = await Promise.all([
    supabase
      .from('insumos')
      .select('id, nombre, unidad_medida, stock_actual, stock_minimo, activo, modo_obtencion')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre, telefono, contacto, notas, activo')
      .eq('activo', true)
      .order('nombre'),
    // Sin filtro de proveedor en la carga inicial; el filtro se re-consulta
    // vía server action (obtenerHistorialCompras) cuando el usuario lo cambia.
    supabase.rpc('historial_precios_compras', { p_proveedor_id: null, p_limit: 100 }),
    supabase.from('categorias').select('id, nombre, orden').eq('activa', true).order('orden'),
    supabase
      .from('productos')
      .select('id, nombre, categoria_id, es_combo')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('recetas').select('id, producto_id'),
    supabase.from('receta_insumos').select('receta_id, opcion_id').not('opcion_id', 'is', null),
    supabase.from('combo_productos').select('combo_id'),
    supabase.from('grupos_modificadores').select('id, producto_id, requerido').eq('activo', true),
    supabase.from('opciones_modificador').select('id, grupo_id').eq('activa', true),
  ])

  const insumos: InsumoInventario[] = (rawInsumos ?? []).map((i: any) => ({
    id: i.id,
    nombre: i.nombre,
    unidad_medida: i.unidad_medida,
    stock_actual: i.stock_actual,
    stock_minimo: i.stock_minimo,
    activo: i.activo,
    modo_obtencion: i.modo_obtencion ?? 'comprado',
  }))

  const proveedores: ProveedorInventario[] = (rawProveedores ?? []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    telefono: p.telefono ?? null,
    contacto: p.contacto ?? null,
    notas: p.notas ?? null,
    activo: p.activo,
  }))

  const historial: HistorialPrecioItem[] = (rawHistorial ?? []).map(mapHistorialRow)

  // ── Estado de receta por producto (para la pestaña Recetas) ────────────────
  const recetaPorProducto = new Map<number, number>(
    (rawRecetas ?? []).map((r: any) => [r.producto_id, r.id]),
  )
  const opcionesConRecetaPorReceta = new Map<number, Set<number>>()
  for (const ri of (rawRecetaInsumos ?? []) as { receta_id: number; opcion_id: number }[]) {
    if (!opcionesConRecetaPorReceta.has(ri.receta_id)) {
      opcionesConRecetaPorReceta.set(ri.receta_id, new Set())
    }
    opcionesConRecetaPorReceta.get(ri.receta_id)!.add(ri.opcion_id)
  }
  const combosConComponentes = new Set(
    (rawComboProductos ?? []).map((cp: any) => cp.combo_id as number),
  )
  const gruposRequeridosPorProducto = new Map<number, number[]>()
  for (const g of (rawGrupos ?? []) as { id: number; producto_id: number; requerido: boolean }[]) {
    if (!g.requerido) continue
    if (!gruposRequeridosPorProducto.has(g.producto_id)) {
      gruposRequeridosPorProducto.set(g.producto_id, [])
    }
    gruposRequeridosPorProducto.get(g.producto_id)!.push(g.id)
  }
  const opcionesPorGrupo = new Map<number, number[]>()
  for (const o of (rawOpciones ?? []) as { id: number; grupo_id: number }[]) {
    if (!opcionesPorGrupo.has(o.grupo_id)) opcionesPorGrupo.set(o.grupo_id, [])
    opcionesPorGrupo.get(o.grupo_id)!.push(o.id)
  }

  function estadoDeProducto(p: { id: number; es_combo: boolean }): EstadoReceta {
    if (p.es_combo) {
      return combosConComponentes.has(p.id) ? 'completa' : 'sin_receta'
    }
    const recetaId = recetaPorProducto.get(p.id)
    if (recetaId === undefined) return 'sin_receta'
    const opcionesConReceta = opcionesConRecetaPorReceta.get(recetaId) ?? new Set<number>()
    const gruposReq = gruposRequeridosPorProducto.get(p.id) ?? []
    const incompleta = gruposReq.some((grupoId) => {
      const opciones = opcionesPorGrupo.get(grupoId) ?? []
      return !opciones.some((oid) => opcionesConReceta.has(oid))
    })
    return incompleta ? 'incompleta' : 'completa'
  }

  const categoriaMap = new Map(
    ((rawCategorias ?? []) as { id: number; nombre: string }[]).map((c) => [c.id, c.nombre]),
  )
  const productosPorCategoria = new Map<number, RecetaProductoItem[]>()
  for (const p of (rawProductos ?? []) as { id: number; nombre: string; categoria_id: number; es_combo: boolean }[]) {
    if (!productosPorCategoria.has(p.categoria_id)) productosPorCategoria.set(p.categoria_id, [])
    productosPorCategoria.get(p.categoria_id)!.push({
      productoId: p.id,
      nombre: p.nombre,
      esCombo: p.es_combo,
      estado: estadoDeProducto(p),
    })
  }

  const categoriasConRecetas: CategoriaConRecetas[] = ((rawCategorias ?? []) as { id: number; nombre: string }[])
    .filter((c) => (productosPorCategoria.get(c.id)?.length ?? 0) > 0)
    .map((c) => ({
      categoriaId: c.id,
      categoriaNombre: categoriaMap.get(c.id) ?? '',
      productos: productosPorCategoria.get(c.id) ?? [],
    }))

  return (
    <InventarioShell
      insumos={insumos}
      proveedores={proveedores}
      historial={historial}
      categoriasConRecetas={categoriasConRecetas}
    />
  )
}
