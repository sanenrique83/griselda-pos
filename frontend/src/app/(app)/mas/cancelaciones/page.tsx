import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { CancelacionesShell } from '@/components/cancelaciones/CancelacionesShell'
import { fechaHoyMX, sumarDiasFecha, inicioDiaMxUtc } from '@/lib/fechaMx'
import { primerNombreValido } from '@/lib/nombreUsuario'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type CancelacionRow = {
  id: number
  createdAt: string
  mesaLabel: string
  meseroNombre: string
  productoNombre: string
  modificadores: string[]
  motivo: string
  monto: number
}

export type FiltroOpcion = {
  id: string
  nombre: string
}

export type CancelacionesFiltros = {
  desde: string
  hasta: string
  meseroId: string | null
  motivo: string | null
  productoId: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CancelacionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string
    hasta?: string
    mesero?: string
    motivo?: string
    producto?: string
  }>
}) {
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

  const sp = await searchParams
  const hoy = fechaHoyMX()
  const filtros: CancelacionesFiltros = {
    desde: sp.desde ?? sumarDiasFecha(hoy, -30),
    hasta: sp.hasta ?? hoy,
    meseroId: sp.mesero ?? null,
    motivo: sp.motivo ?? null,
    productoId: sp.producto ?? null,
  }

  // ── Opciones de los filtros (meseros y productos, catálogos acotados) ────
  const [{ data: perfilesData }, { data: productosData }] = await Promise.all([
    supabase.from('perfiles').select('id, nombre').order('nombre'),
    supabase.from('productos').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  const meserosOpciones: FiltroOpcion[] = (perfilesData ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
  }))
  const productosOpciones: FiltroOpcion[] = (productosData ?? []).map((p) => ({
    id: String(p.id),
    nombre: p.nombre,
  }))

  // ── Cancelaciones filtradas ───────────────────────────────────────────────
  let query = supabase
    .from('cancelaciones')
    .select(
      `
      id, motivo, monto_afectado, created_at, usuario_id,
      pedido_productos!inner(
        producto_id, nombre_libre,
        productos(nombre),
        pedido_producto_opciones(opciones_modificador(nombre)),
        subpedidos(
          pedido_id,
          pedidos( tipo, mesas(numero, nombre) )
        )
      )
    `,
    )
    .gte('created_at', inicioDiaMxUtc(filtros.desde))
    .lt('created_at', inicioDiaMxUtc(sumarDiasFecha(filtros.hasta, 1)))
    .order('created_at', { ascending: false })

  if (filtros.meseroId) query = query.eq('usuario_id', filtros.meseroId)
  if (filtros.motivo) query = query.ilike('motivo', `%${filtros.motivo}%`)
  if (filtros.productoId) query = query.eq('pedido_productos.producto_id', Number(filtros.productoId))

  const { data: cancelacionesRaw } = await query

  const usuarioIds = Array.from(
    new Set((cancelacionesRaw ?? []).map((c) => c.usuario_id).filter((id): id is string => !!id)),
  )
  const nombrePorUsuario = new Map(
    (perfilesData ?? []).filter((p) => usuarioIds.includes(p.id)).map((p) => [p.id, p.nombre]),
  )

  const filas: CancelacionRow[] = (cancelacionesRaw ?? []).map((c: any) => {
    const pp = c.pedido_productos
    const pedido = pp?.subpedidos?.pedidos
    const mesa = pedido?.mesas

    let mesaLabel = 'Para llevar'
    if (pedido?.tipo === 'mesa' && mesa) {
      mesaLabel = `Mesa ${mesa.nombre ?? mesa.numero}`
    } else if (pedido?.tipo === 'mostrador') {
      mesaLabel = 'Mostrador'
    }

    const modificadores: string[] = (pp?.pedido_producto_opciones ?? [])
      .map((o: any) => o.opciones_modificador?.nombre as string | undefined)
      .filter((n: string | undefined): n is string => !!n)

    return {
      id: c.id,
      createdAt: c.created_at,
      mesaLabel,
      meseroNombre: primerNombreValido(c.usuario_id ? nombrePorUsuario.get(c.usuario_id) : undefined),
      productoNombre: pp?.nombre_libre || pp?.productos?.nombre || 'Producto eliminado',
      modificadores,
      motivo: c.motivo,
      monto: c.monto_afectado,
    }
  })

  return (
    <CancelacionesShell
      filas={filas}
      filtros={filtros}
      meserosOpciones={meserosOpciones}
      productosOpciones={productosOpciones}
    />
  )
}
