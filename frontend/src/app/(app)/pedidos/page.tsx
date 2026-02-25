import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PedidosShell } from '@/components/pedidos/PedidosShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type PedidoActivo = {
  id: number
  tipo: 'mesa' | 'llevar'
  mesaLabel: string
  numComensales: number
  createdAt: string
  total: number
  pendientes: number
  enviados: number
  cancelados: number
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PedidosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carga pedidos abiertos con subpedidos y productos
  const { data: rawPedidos } = await supabase
    .from('pedidos')
    .select(
      `id, tipo, num_comensales, created_at, mesa_id,
       mesas(numero, nombre),
       subpedidos(
         pedido_productos(cantidad, precio_unit, estado)
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

    const mesa = p.mesas as { numero: number; nombre: string | null } | null
    const mesaLabel =
      p.tipo === 'mesa'
        ? mesa
          ? `Mesa ${mesa.nombre ?? mesa.numero}`
          : `Mesa #${p.mesa_id}`
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
    }
  })

  return <PedidosShell pedidos={pedidos} />
}
