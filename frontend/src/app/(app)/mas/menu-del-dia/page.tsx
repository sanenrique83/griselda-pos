import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { MenuDelDiaShell } from '@/components/menu-del-dia/MenuDelDiaShell'
import { columnaOrden } from '@/lib/ordenCatalogo'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type ProductoMenu = {
  id: number
  nombre: string
  emoji: string | null
  disponible: boolean
  categoria_id: number
}

export type CategoriaMenu = {
  id: number
  nombre: string
  productos: ProductoMenu[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MenuDelDiaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single<Pick<Perfil, 'rol'>>()

  if (perfil?.rol !== 'admin') redirect('/mas')

  const { data: configOrden } = await supabase
    .from('config_sistema')
    .select('orden_productos')
    .eq('id', 1)
    .single()
  const ordenProductos = columnaOrden((configOrden as any)?.orden_productos)

  const [{ data: rawCategorias }, { data: rawProductos }] = await Promise.all([
    supabase
      .from('categorias')
      .select('id, nombre')
      .eq('activa', true)
      .order('orden'),
    supabase
      .from('productos')
      .select('id, nombre, emoji, disponible, categoria_id')
      .eq('activo', true)
      .order(ordenProductos.column, { ascending: ordenProductos.ascending }),
  ])

  // Agrupar productos por categoría
  const categorias: CategoriaMenu[] = (rawCategorias ?? []).map((cat: any) => ({
    id: cat.id,
    nombre: cat.nombre,
    productos: (rawProductos ?? [])
      .filter((p: any) => p.categoria_id === cat.id)
      .map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        emoji: p.emoji ?? null,
        disponible: p.disponible,
        categoria_id: p.categoria_id,
      })),
  })).filter((cat) => cat.productos.length > 0)

  const totalProductos = (rawProductos ?? []).length
  const disponibles = (rawProductos ?? []).filter((p: any) => p.disponible).length

  return (
    <MenuDelDiaShell
      categorias={categorias}
      totalProductos={totalProductos}
      disponibles={disponibles}
    />
  )
}
