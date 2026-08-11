import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CobroShell } from '@/components/cobro/CobroShell'
import type { ItemCliente, TicketConfig } from '@/lib/print'
import { agruparPorGrupo, construirFraseModificadores, type OpcionConGrupo } from '@/lib/descripcionNatural'
import { primerNombreValido } from '@/lib/nombreUsuario'

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
    .select('id, tipo, estado, turno_id, mesa_id, mesero_id, num_comensales, cliente_nombre, mesas(numero, nombre)')
    .eq('id', pedidoId)
    .single()

  if (!pedido || pedido.estado !== 'abierto') redirect('/mesas')

  // ── Subpedidos con totales e ítems ─────────────────────────────────────────
  const { data: rawSubs } = await supabase
    .from('subpedidos')
    .select(`
      id, comensal_numero, nombre, estado,
      pedido_productos(
        cantidad, precio_unit, estado, nombre_libre,
        productos(nombre),
        pedido_producto_opciones(
          precio_extra,
          opciones_modificador(nombre, grupo_id, grupos_modificadores!opciones_modificador_grupo_id_fkey(orden, conector, prefijo_seleccion_unica))
        )
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
        propina_sugerida_pct, propinas_sugeridas_pct, moneda, impresion_activa,
        transferencia_banco, transferencia_clabe, transferencia_titular,
        descuentos_mesero, descuento_max_pct,
        ticket_nombre, ticket_subtitulo, ticket_direccion, ticket_telefono, ticket_rfc,
        ticket_linea1, ticket_linea2, ticket_pie, ticket_pie2, modificadores_por_linea,
        formato_modificadores_ticket
      `)
      .eq('id', 1)
      .single(),
    user
      ? supabase.from('perfiles').select('rol').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  // Mesero del PEDIDO (no necesariamente quien está cobrando, ej. admin
  // cobrando la mesa de otro mesero) — para el bloque de encabezado del
  // ticket de cliente, resuelto con el mismo primerNombreValido() que usa
  // el resto de la app.
  const { data: perfilMesero } = (pedido as any).mesero_id
    ? await supabase.from('perfiles').select('nombre').eq('id', (pedido as any).mesero_id).single()
    : { data: null }
  const meseroNombreTicket = primerNombreValido((perfilMesero as any)?.nombre)

  // ── Transformar subpedidos ──────────────────────────────────────────────────
  const formatoModificadores = (config as any)?.formato_modificadores_ticket ?? 'agrupado'
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
      const nombreBase = pp.nombre_libre || pp.productos?.nombre || ''

      // Formato 'texto_natural': el nombre del producto se queda puro (para
      // que el precio alinee contra la primera línea) y la frase de
      // modificadores se manda como una sola entrada en `modificadores`, en
      // su propia línea debajo — ver lib/descripcionNatural.ts.
      // 'lista'/'agrupado' (existentes) siguen mandando el arreglo tal
      // cual, sin cambios.
      if (formatoModificadores === 'texto_natural') {
        const conGrupo: OpcionConGrupo[] = opciones
          .filter((o: any) => o.opciones_modificador?.grupos_modificadores)
          .map((o: any) => ({
            nombre: o.opciones_modificador.nombre,
            grupoId: o.opciones_modificador.grupo_id,
            grupoOrden: o.opciones_modificador.grupos_modificadores.orden,
            grupoConector: o.opciones_modificador.grupos_modificadores.conector,
            grupoPrefijoSeleccionUnica: o.opciones_modificador.grupos_modificadores.prefijo_seleccion_unica,
          }))
        const frase = construirFraseModificadores(agruparPorGrupo(conGrupo))
        return {
          nombre: nombreBase,
          cantidad: pp.cantidad,
          precio: pp.precio_unit + extras,
          ...(frase ? { modificadores: [frase] } : {}),
        }
      }

      const modificadores = opciones
        .map((o: any) => o.opciones_modificador?.nombre as string | undefined)
        .filter((n): n is string => !!n)
      return {
        nombre: nombreBase,
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

  // Propinas sugeridas (chips) — propinas_sugeridas_pct (CSV) es la fuente
  // nueva; si nunca se configuró (NULL, distinto de '' que sí es "el admin
  // lo dejó vacío a propósito") cae de vuelta al único porcentaje anterior
  // para no perder configuración previa (ver migración 20260801000029).
  const csvPropinas = (config as any)?.propinas_sugeridas_pct as string | null | undefined
  const propinasSugeridas: number[] = (
    csvPropinas !== null && csvPropinas !== undefined
      ? csvPropinas.split(',')
      : (config as any)?.propina_sugerida_pct > 0
        ? [String((config as any).propina_sugerida_pct)]
        : []
  )
    .map((p: string) => parseFloat(p.trim()))
    .filter((n: number) => !isNaN(n) && n > 0)

  const ticketConfig: TicketConfig = {
    nombre: (config as any)?.ticket_nombre ?? 'La Menuderia',
    subtitulo: (config as any)?.ticket_subtitulo ?? '',
    direccion: (config as any)?.ticket_direccion ?? '',
    telefono: (config as any)?.ticket_telefono ?? '',
    rfc: (config as any)?.ticket_rfc ?? '',
    linea1: (config as any)?.ticket_linea1 ?? '',
    linea2: (config as any)?.ticket_linea2 ?? '',
    pie: (config as any)?.ticket_pie ?? 'Gracias por su visita!',
    pie2: (config as any)?.ticket_pie2 ?? '',
    modificadores_por_linea: (config as any)?.modificadores_por_linea ?? 1,
    formato_modificadores_ticket: formatoModificadores,
  }

  return (
    <CobroShell
      pedidoId={pedidoId}
      turnoId={(pedido as any).turno_id}
      mesaId={(pedido as any).mesa_id ?? null}
      mesaLabel={mesaLabel}
      subpedidos={subpedidos}
      totalPedido={totalPedido}
      propinasSugeridas={propinasSugeridas}
      datosBancarios={{
        banco: (config as any)?.transferencia_banco ?? null,
        clabe: (config as any)?.transferencia_clabe ?? null,
        titular: (config as any)?.transferencia_titular ?? null,
      }}
      descuentoHabilitado={descuentoHabilitado}
      descuentoMaxPct={descuentoMaxPct}
      ticketConfig={ticketConfig}
      impresionActiva={(config as any)?.impresion_activa ?? false}
      mesero={meseroNombreTicket}
      orden={String(pedidoId)}
      tipoMesa={pedido.tipo as 'mesa' | 'llevar' | 'mostrador'}
      numComensales={(pedido as any).num_comensales ?? null}
      clienteNombre={(pedido as any).cliente_nombre ?? null}
    />
  )
}
