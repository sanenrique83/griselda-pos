import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PedidosShell } from '@/components/pedidos/PedidosShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type ProductoDetalle = {
  id: number
  nombre: string
  cantidad: number
  estado: 'pendiente' | 'enviado' | 'cancelado'
  enviadoEn: string | null
}

export type ComensalDetalle = {
  id: number
  numero: number
  nombre: string | null
  productos: ProductoDetalle[]
}

export type PedidoActivo = {
  id: number
  tipo: 'mesa' | 'llevar' | 'mostrador'
  mesaLabel: string
  numComensales: number
  createdAt: string
  total: number
  pendientes: number
  enviados: number
  cancelados: number
  comensales: ComensalDetalle[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PedidosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carga pedidos abiertos con subpedidos y productos — nombre_libre/productos(nombre)
  // y enviado_en se agregan para el detalle por comensal (antes solo se
  // contaba cantidad/precio_unit/estado, sin mostrar qué se pidió).
  const { data: rawPedidos } = await supabase
    .from('pedidos')
    .select(
      `id, tipo, num_comensales, created_at, mesa_id,
       mesas(numero, nombre),
       subpedidos(
         id, comensal_numero, nombre,
         pedido_productos(id, cantidad, precio_unit, estado, nombre_libre, enviado_en, productos(nombre))
       )`,
    )
    .eq('estado', 'abierto')
    .order('created_at', { ascending: true })

  const pedidos: PedidoActivo[] = (rawPedidos ?? []).map((p: any) => {
    // Aplanar todos los productos de todos los subpedidos
    const productos: { cantidad: number; precio_unit: number; estado: string }[] = (
      p.subpedidos ?? []
    ).flatMap((s: any) => s.pedido_productos ?? [])

    const total = productos
      .filter((pp) => pp.estado !== 'cancelado')
      .reduce((sum, pp) => sum + pp.cantidad * pp.precio_unit, 0)

    const pendientes = productos.filter((pp) => pp.estado === 'pendiente').length
    const enviados = productos.filter((pp) => pp.estado === 'enviado').length
    const cancelados = productos.filter((pp) => pp.estado === 'cancelado').length

    const comensales: ComensalDetalle[] = (p.subpedidos ?? [])
      .slice()
      .sort((a: any, b: any) => a.comensal_numero - b.comensal_numero)
      .map((s: any) => ({
        id: s.id,
        numero: s.comensal_numero,
        nombre: s.nombre ?? null,
        productos: (s.pedido_productos ?? []).map((pp: any) => ({
          id: pp.id,
          nombre: pp.nombre_libre || pp.productos?.nombre || '',
          cantidad: pp.cantidad,
          estado: pp.estado,
          enviadoEn: pp.enviado_en ?? null,
        })),
      }))

    const mesa = p.mesas as { numero: number; nombre: string | null } | null
    const mesaLabel =
      p.tipo === 'mesa'
        ? mesa
          ? `Mesa ${mesa.nombre ?? mesa.numero}`
          : `Mesa #${p.mesa_id}`
        : p.tipo === 'mostrador'
          ? 'Mostrador'
          : 'Para llevar'

    return {
      id: p.id,
      tipo: p.tipo,
      mesaLabel,
      numComensales: p.num_comensales,
      createdAt: p.created_at,
      total,
      pendientes,
      enviados,
      cancelados,
      comensales,
    }
  })

  return <PedidosShell pedidos={pedidos} />
}
