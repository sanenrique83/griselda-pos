import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InventarioShell } from '@/components/inventario/InventarioShell'
import { mapHistorialRow } from './mappers'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type UnidadMedida = 'kg' | 'g' | 'l' | 'ml' | 'pieza' | 'paquete'

export type InsumoInventario = {
  id: number
  nombre: string
  unidad_medida: UnidadMedida
  stock_actual: number
  stock_minimo: number
  activo: boolean
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

  const [{ data: rawInsumos }, { data: rawProveedores }, { data: rawHistorial }] =
    await Promise.all([
      supabase
        .from('insumos')
        .select('id, nombre, unidad_medida, stock_actual, stock_minimo, activo')
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
    ])

  const insumos: InsumoInventario[] = (rawInsumos ?? []).map((i: any) => ({
    id: i.id,
    nombre: i.nombre,
    unidad_medida: i.unidad_medida,
    stock_actual: i.stock_actual,
    stock_minimo: i.stock_minimo,
    activo: i.activo,
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

  return <InventarioShell insumos={insumos} proveedores={proveedores} historial={historial} />
}
