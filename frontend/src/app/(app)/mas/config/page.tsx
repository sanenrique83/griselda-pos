import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { ImpresionShell } from '@/components/config/ImpresionShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type ImpresoraData = {
  id: number
  nombre: string
  ip: string
  puerto: number
  ancho_papel: '58mm' | '80mm'
  activa: boolean
  imprimir_recibos_cuentas: boolean
  imprimir_pedidos: boolean
  imprimir_automaticamente: boolean
  un_articulo_por_ticket: boolean
  agrupar_identicos: boolean
}

export type GrupoData = {
  id: number
  nombre: string
  impresora_id: number
  activo: boolean
  categorias: { id: number; nombre: string }[]
}

export type CategoriaSimple = {
  id: number
  nombre: string
  grupo_impresora_id: number | null
}

export type ConfigData = {
  impresionGlobal: boolean
  impresoras: ImpresoraData[]
  grupos: GrupoData[]
  categorias: CategoriaSimple[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ConfigPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single<Pick<Perfil, 'rol'>>()

  if (perfil?.rol !== 'admin') redirect('/mas')

  // ── Carga en paralelo ─────────────────────────────────────────────────────
  const [configRes, impresorasRes, gruposRes, categoriasRes] =
    await Promise.all([
      supabase
        .from('config_sistema')
        .select('impresion_activa')
        .eq('id', 1)
        .single(),
      supabase.from('impresoras').select('*').order('id'),
      supabase.from('grupos_impresora').select('*').order('id'),
      supabase
        .from('categorias')
        .select('id, nombre, grupo_impresora_id')
        .eq('activa', true)
        .order('orden'),
    ])

  // ── Agrupar categorías por grupo_impresora_id ─────────────────────────────
  const catsPorGrupo = new Map<number, { id: number; nombre: string }[]>()
  const categorias: CategoriaSimple[] = []

  for (const cat of categoriasRes.data ?? []) {
    categorias.push({
      id: cat.id,
      nombre: cat.nombre,
      grupo_impresora_id: cat.grupo_impresora_id ?? null,
    })
    if (!cat.grupo_impresora_id) continue
    const arr = catsPorGrupo.get(cat.grupo_impresora_id) ?? []
    arr.push({ id: cat.id, nombre: cat.nombre })
    catsPorGrupo.set(cat.grupo_impresora_id, arr)
  }

  const impresoras: ImpresoraData[] = (impresorasRes.data ?? []).map(
    (imp: any) => ({
      id: imp.id,
      nombre: imp.nombre,
      ip: imp.ip,
      puerto: imp.puerto,
      ancho_papel: imp.ancho_papel ?? '80mm',
      activa: imp.activa,
      imprimir_recibos_cuentas: imp.imprimir_recibos_cuentas,
      imprimir_pedidos: imp.imprimir_pedidos,
      imprimir_automaticamente: imp.imprimir_automaticamente,
      un_articulo_por_ticket: imp.un_articulo_por_ticket,
      agrupar_identicos: imp.agrupar_identicos,
    }),
  )

  const grupos: GrupoData[] = (gruposRes.data ?? []).map((g: any) => ({
    id: g.id,
    nombre: g.nombre,
    impresora_id: g.impresora_id,
    activo: g.activo,
    categorias: catsPorGrupo.get(g.id) ?? [],
  }))

  const configData: ConfigData = {
    impresionGlobal: configRes.data?.impresion_activa ?? false,
    impresoras,
    grupos,
    categorias,
  }

  return <ImpresionShell initialData={configData} />
}
