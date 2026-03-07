import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CobroShell } from '@/components/cobro/CobroShell'
import type { ItemCliente, TicketConfig } from '@/lib/print'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type SubpedidoCobro = {
  id: number
  comensal_numero: number
  nombre: string | null
  total: number
  items: ItemCliente[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CobroPage({
  params,
}: {
  params: Promise<{ pedidoId: string }>
}) {
  const { pedidoId: pedidoIdStr } = await params
  const pedidoId = Number(pedidoIdStr)
  if (isNaN(pedidoId)) redirect('/mesas')

  const supabase = await createClient()

  // ── Pedido ──────────────────────────────────────────────────────────────────
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, tipo, estado, turno_id, mesa_id, mesas(numero, nombre)')
    .eq('id', pedidoId)
    .single()

  if (!pedido || pedido.estado !== 'abierto') redirect('/mesas')

  // ── Subpedidos con totales e ítems ─────────────────────────────────────────
  const { data: rawSubs } = await supabase
    .from('subpedidos')
    .select(`
      id, comensal_numero, nombre, estado,
      pedido_productos(
        cantidad, precio_unit, estado,
        productos(nombre),
        pedido_producto_opciones(precio_extra, opciones_modificador(nombre))
      )
    `)
    .eq('pedido_id', pedidoId)
    .neq('estado', 'pagado')
    .order('comensal_numero')

  // ── Config del sistema ──────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: config }, { data: perfil }] = await Promise.all([
    supabase
      .from('config_sistema')
      .select(`
        propina_sugerida_pct, moneda,
        transferencia_banco, transferencia_clabe, transferencia_titular,
        descuentos_mesero, descuento_max_pct,
        ticket_nombre, ticket_direccion, ticket_telefono, ticket_rfc,
        ticket_linea1, ticket_linea2, ticket_pie, ticket_pie2
      `)
      .eq('id', 1)
      .single(),
    user
      ? supabase.from('perfiles').select('rol').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  // ── Transformar subpedidos ──────────────────────────────────────────────────
  const subpedidos: SubpedidoCobro[] = (rawSubs ?? []).map((sub: any) => {
    const prods = (sub.pedido_productos ?? []).filter(
      (pp: any) => pp.estado !== 'cancelado',
    )
    const total = prods.reduce((s: number, pp: any) => {
      const extras = (pp.pedido_producto_opciones ?? []).reduce(
        (e: number, o: any) => e + o.precio_extra,
        0,
      )
      return s + (pp.precio_unit + extras) * pp.cantidad
    }, 0)
    const items: ItemCliente[] = prods.map((pp: any) => {
      const opciones: any[] = pp.pedido_producto_opciones ?? []
      const extras = opciones.reduce((e: number, o: any) => e + o.precio_extra, 0)
      const modificadores = opciones
        .map((o: any) => o.opciones_modificador?.nombre as string | undefined)
        .filter((n): n is string => !!n)
      return {
        nombre: pp.productos?.nombre ?? '',
        cantidad: pp.cantidad,
        precio: pp.precio_unit + extras, // precio unitario consolidado
        ...(modificadores.length > 0 ? { modificadores } : {}),
      }
    })
    return {
      id: sub.id,
      comensal_numero: sub.comensal_numero,
      nombre: sub.nombre ?? null,
      total,
      items,
    }
  })

  const totalPedido = subpedidos.reduce((s, sp) => s + sp.total, 0)

  const mesa = (pedido as any).mesas
  const mesaLabel =
    pedido.tipo === 'mesa'
      ? (mesa?.nombre ?? `Mesa ${mesa?.numero ?? pedidoId}`)
      : 'Para llevar'

  const esAdmin = (perfil as any)?.rol === 'admin'
  const descuentoHabilitado =
    esAdmin || ((config as any)?.descuentos_mesero === true)
  const descuentoMaxPct = esAdmin ? 100 : ((config as any)?.descuento_max_pct ?? 0)

  const ticketConfig: TicketConfig = {
    nombre: (config as any)?.ticket_nombre ?? 'La Menuderia',
    direccion: (config as any)?.ticket_direccion ?? '',
    telefono: (config as any)?.ticket_telefono ?? '',
    rfc: (config as any)?.ticket_rfc ?? '',
    linea1: (config as any)?.ticket_linea1 ?? '',
    linea2: (config as any)?.ticket_linea2 ?? '',
    pie: (config as any)?.ticket_pie ?? 'Gracias por su visita!',
    pie2: (config as any)?.ticket_pie2 ?? '',
  }

  return (
    <CobroShell
      pedidoId={pedidoId}
      turnoId={(pedido as any).turno_id}
      mesaId={(pedido as any).mesa_id ?? null}
      mesaLabel={mesaLabel}
      subpedidos={subpedidos}
      totalPedido={totalPedido}
      propinaPct={config?.propina_sugerida_pct ?? 0}
      datosBancarios={{
        banco: (config as any)?.transferencia_banco ?? null,
        clabe: (config as any)?.transferencia_clabe ?? null,
        titular: (config as any)?.transferencia_titular ?? null,
      }}
      descuentoHabilitado={descuentoHabilitado}
      descuentoMaxPct={descuentoMaxPct}
      ticketConfig={ticketConfig}
    />
  )
}
