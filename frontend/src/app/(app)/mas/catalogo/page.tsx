import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CatalogoShell } from '@/components/catalogo/CatalogoShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type MesaCatalogo = {
  id: number
  numero: number
  nombre: string | null
  capacidad: number | null
  activa: boolean
}

export type AreaCatalogo = {
  id: number
  nombre: string
  orden: number
  activa: boolean
  mesas: MesaCatalogo[]
}

export type CategoriaCatalogo = {
  id: number
  nombre: string
  orden: number
  activa: boolean
  modo_captura: 'estandar' | 'rapido'
}

export type ProductoCatalogo = {
  id: number
  nombre: string
  descripcion: string | null
  precio: number
  emoji: string | null
  foto_url: string | null
  disponible: boolean
  activo: boolean
  modo_captura: 'estandar' | 'rapido'
  categoria_id: number
  categoria_nombre: string
}

export type OpcionCatalogo = {
  id: number
  grupo_id: number
  nombre: string
  precio_extra: number
  orden: number
  activa: boolean
}

export type GrupoModificadorCatalogo = {
  id: number
  producto_id: number
  nombre: string
  requerido: boolean
  minimo: number
  maximo: number
  orden: number
  opciones: OpcionCatalogo[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CatalogoPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Solo admin
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'admin') redirect('/mesas')

  // ── Áreas y mesas ──────────────────────────────────────────────────────────
  const [
    { data: rawAreas },
    { data: rawMesas },
    { data: rawCategorias },
    { data: rawProductos },
  ] = await Promise.all([
    supabase.from('areas').select('id, nombre, orden, activa').eq('activa', true).order('orden'),
    supabase.from('mesas').select('id, area_id, numero, nombre, capacidad, activa').eq('activa', true).order('numero'),
    supabase.from('categorias').select('id, nombre, orden, activa, modo_captura').eq('activa', true).order('orden'),
    supabase.from('productos').select('id, nombre, descripcion, precio, emoji, foto_url, disponible, activo, modo_captura, categoria_id').eq('activo', true).order('orden'),
  ])

  // Mapa de categorías por id
  const catMap = new Map((rawCategorias ?? []).map((c: any) => [c.id, c.nombre as string]))

  // Armar áreas con mesas
  const areas: AreaCatalogo[] = (rawAreas ?? []).map((a: any) => ({
    id: a.id,
    nombre: a.nombre,
    orden: a.orden,
    activa: a.activa,
    mesas: (rawMesas ?? [])
      .filter((m: any) => m.area_id === a.id)
      .map((m: any) => ({
        id: m.id,
        numero: m.numero,
        nombre: m.nombre ?? null,
        capacidad: m.capacidad ?? null,
        activa: m.activa,
      })),
  }))

  const categorias: CategoriaCatalogo[] = (rawCategorias ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    orden: c.orden,
    activa: c.activa,
    modo_captura: c.modo_captura ?? 'estandar',
  }))

  const productos: ProductoCatalogo[] = (rawProductos ?? []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion ?? null,
    precio: p.precio,
    emoji: p.emoji ?? null,
    foto_url: p.foto_url ?? null,
    disponible: p.disponible,
    activo: p.activo,
    modo_captura: p.modo_captura ?? 'estandar',
    categoria_id: p.categoria_id,
    categoria_nombre: catMap.get(p.categoria_id) ?? '',
  }))

  return (
    <CatalogoShell
      areas={areas}
      categorias={categorias}
      productos={productos}
    />
  )
}
