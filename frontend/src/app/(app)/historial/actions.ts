'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { imprimirTicket, consolidarItemsCliente, type ItemCliente, type TicketConfig } from '@/lib/print'

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

// ─── Reabrir pedido ───────────────────────────────────────────────────────────

export async function reabrirPedido(
  pedidoId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('reabrir_pedido', { p_pedido_id: pedidoId })

  if (error) return { ok: false, error: error.message || 'No se pudo reabrir el pedido.' }

  revalidatePath('/historial')
  revalidatePath('/mesas')
  revalidatePath('/pedidos')
  return { ok: true }
}

export async function reimprimirTicketCliente(
  movimientoId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()

  const { data: movimiento } = await supabase
    .from('movimientos_caja')
    .select(`
      id, monto, propina, efectivo_recibido, cambio,
      pagos(metodo_pago),
      cobro_subpedidos(
        subpedido_id,
        subpedidos(
          pedidos( tipo, mesas(numero, nombre) )
        )
      )
    `)
    .eq('id', movimientoId)
    .eq('tipo', 'cobro')
    .single()

  if (!movimiento) return { ok: false, error: 'Recibo no encontrado.' }

  const cobros = (movimiento.cobro_subpedidos ?? []) as any[]
  const subpedidoIds = cobros.map((cs) => cs.subpedido_id)
  if (subpedidoIds.length === 0) return { ok: false, error: 'El recibo no tiene productos.' }

  const pedido = cobros[0]?.subpedidos?.pedidos
  let mesaLabel = 'Para llevar'
  if (pedido?.tipo === 'mesa' && pedido.mesas) {
    mesaLabel = `Mesa ${pedido.mesas.nombre ?? pedido.mesas.numero}`
  } else if (pedido?.tipo === 'mostrador') {
    mesaLabel = 'Mostrador'
  }

  const { data: rawProductos } = await supabase
    .from('pedido_productos')
    .select(`
      cantidad, precio_unit, nombre_libre,
      productos(nombre),
      pedido_producto_opciones(precio_extra, opciones_modificador(nombre))
    `)
    .in('subpedido_id', subpedidoIds)
    .neq('estado', 'cancelado')

  const items: ItemCliente[] = (rawProductos ?? []).map((pp: any) => {
    const opciones: any[] = pp.pedido_producto_opciones ?? []
    const extras = opciones.reduce((e: number, o: any) => e + o.precio_extra, 0)
    const modificadores = opciones
      .map((o: any) => o.opciones_modificador?.nombre as string | undefined)
      .filter((n): n is string => !!n)
    return {
      nombre: pp.nombre_libre || pp.productos?.nombre || '',
      cantidad: pp.cantidad,
      precio: pp.precio_unit + extras,
      ...(modificadores.length > 0 ? { modificadores } : {}),
    }
  })

  if (items.length === 0) return { ok: false, error: 'El recibo no tiene productos.' }

  const printItems = consolidarItemsCliente(items)

  const { data: config } = await supabase
    .from('config_sistema')
    .select(`
      impresion_activa,
      ticket_nombre, ticket_direccion, ticket_telefono, ticket_rfc,
      ticket_linea1, ticket_linea2, ticket_pie, ticket_pie2
    `)
    .eq('id', 1)
    .single()

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

  const pagos = movimiento.pagos ?? []
  const metodoLabel =
    pagos.length > 1
      ? 'Mixto'
      : (METODO_LABEL[(pagos[0] as any)?.metodo_pago] ?? 'Efectivo')

  const subtotal = movimiento.monto
  const propina = movimiento.propina ?? 0

  const ok = await imprimirTicket(
    {
      tipo: 'cliente',
      escenario: 'global',
      mesa: mesaLabel,
      items: printItems,
      subtotal,
      propina,
      total: subtotal + propina,
      metodo: metodoLabel,
      recibido: movimiento.efectivo_recibido,
      cambio: movimiento.cambio,
      config: ticketConfig,
    },
    (config as any)?.impresion_activa ?? false,
  )

  return ok ? { ok: true } : { ok: false, error: 'No se pudo conectar con la impresora.' }
}
