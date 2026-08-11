import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PedidosShell } from '@/components/pedidos/PedidosShell'
import { primerNombreValido } from '@/lib/nombreUsuario'

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
  // Suma de (precio_unit + extras de modificadores) × cantidad de los
  // productos no cancelados de este comensal — antes no se calculaba
  // (ProductoDetalle nunca cargaba precio ni extras).
  subtotal: number
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
  // Para el atajo "Órdenes activas" de /mesas (?filtro=cocina|cobro) — mismos
  // conceptos ya usados ahí: enCocina = algún producto 'enviado'; cobroParcial
  // = algún subpedido 'pagado' y al menos uno que no (mismo criterio del
  // semáforo azul en lib/colorMesa.ts).
  enCocina: boolean
  cobroParcial: boolean
  meseroNombre: string
  // Solo relevante para tipo='llevar' — ver print_server.py / pedidos.cliente_nombre.
  clienteNombre: string | null
  // Valor de los subpedidos que aún NO están 'pagado' — a diferencia de
  // `total` (que incluye todo lo no cancelado, pagado o no), esto es lo que
  // realmente falta cobrar de este pedido. Para pedidos sin ningún pago
  // parcial, coincide con `total`.
  montoPendienteCobro: number
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PedidosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: turno }, { data: rawPedidos }] = await Promise.all([
    supabase.from('turnos').select('id').eq('estado', 'abierto').maybeSingle(),
    // Carga pedidos abiertos con subpedidos y productos — nombre_libre/productos(nombre)
    // y enviado_en se agregan para el detalle por comensal. pedido_producto_opciones
    // (precio_extra) se agrega para que los totales (general y por comensal) incluyan
    // los extras de modificadores — antes se omitían del cálculo aquí (a diferencia de
    // cobro/[pedidoId]/page.tsx, que sí los incluye).
    supabase
      .from('pedidos')
      .select(
        `id, tipo, num_comensales, created_at, mesa_id, mesero_id, cliente_nombre,
         mesas(numero, nombre),
         subpedidos(
           id, comensal_numero, nombre, estado,
           pedido_productos(
             id, cantidad, precio_unit, estado, nombre_libre, enviado_en,
             productos(nombre),
             pedido_producto_opciones(precio_extra)
           )
         )`,
      )
      .eq('estado', 'abierto')
      .order('created_at', { ascending: true }),
  ])

  // Nombres de meseros — mismo patrón que /mesas (bulk fetch + primerNombreValido).
  const meseroIds = [...new Set((rawPedidos ?? []).map((p: any) => p.mesero_id).filter(Boolean))]
  const { data: perfiles } = meseroIds.length
    ? await supabase.from('perfiles').select('id, nombre').in('id', meseroIds)
    : { data: [] }
  const perfilMap = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string]))

  function precioConExtras(pp: any): number {
    const extras = (pp.pedido_producto_opciones ?? []).reduce(
      (s: number, o: any) => s + (o.precio_extra ?? 0),
      0,
    )
    return (pp.precio_unit + extras) * pp.cantidad
  }

  const pedidos: PedidoActivo[] = (rawPedidos ?? []).map((p: any) => {
    // Aplanar todos los productos de todos los subpedidos
    const productos: any[] = (p.subpedidos ?? []).flatMap((s: any) => s.pedido_productos ?? [])

    const total = productos
      .filter((pp) => pp.estado !== 'cancelado')
      .reduce((sum, pp) => sum + precioConExtras(pp), 0)

    const pendientes = productos.filter((pp) => pp.estado === 'pendiente').length
    const enviados = productos.filter((pp) => pp.estado === 'enviado').length
    const cancelados = productos.filter((pp) => pp.estado === 'cancelado').length
    const enCocina = productos.some((pp) => pp.estado === 'enviado')

    const estadosSubpedidos: string[] = (p.subpedidos ?? []).map((s: any) => s.estado)
    const algunoPagado = estadosSubpedidos.some((e) => e === 'pagado')
    const todosPagados = estadosSubpedidos.length > 0 && estadosSubpedidos.every((e) => e === 'pagado')
    const cobroParcial = algunoPagado && !todosPagados

    const montoPendienteCobro = (p.subpedidos ?? [])
      .filter((s: any) => s.estado !== 'pagado')
      .flatMap((s: any) => s.pedido_productos ?? [])
      .filter((pp: any) => pp.estado !== 'cancelado')
      .reduce((sum: number, pp: any) => sum + precioConExtras(pp), 0)

    const comensales: ComensalDetalle[] = (p.subpedidos ?? [])
      .slice()
      .sort((a: any, b: any) => a.comensal_numero - b.comensal_numero)
      .map((s: any) => {
        const prods = (s.pedido_productos ?? []) as any[]
        return {
          id: s.id,
          numero: s.comensal_numero,
          nombre: s.nombre ?? null,
          productos: prods.map((pp: any) => ({
            id: pp.id,
            nombre: pp.nombre_libre || pp.productos?.nombre || '',
            cantidad: pp.cantidad,
            estado: pp.estado,
            enviadoEn: pp.enviado_en ?? null,
          })),
          subtotal: prods
            .filter((pp) => pp.estado !== 'cancelado')
            .reduce((sum, pp) => sum + precioConExtras(pp), 0),
        }
      })

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
      enCocina,
      cobroParcial,
      meseroNombre: primerNombreValido(p.mesero_id ? perfilMap.get(p.mesero_id) : undefined),
      clienteNombre: p.cliente_nombre ?? null,
      montoPendienteCobro,
    }
  })

  return <PedidosShell pedidos={pedidos} turnoId={turno?.id ?? null} />
}
