import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import type { TicketConfig } from '@/lib/print'
import { CorteZShell } from '@/components/corte-z/CorteZShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type MetodoDesglose = {
  efectivo: number
  tarjeta: number
  transferencia: number
  mixto: number
}

export type TurnoDelDia = {
  id: number
  aperturaIso: string
  cierreIso: string | null
  estado: 'abierto' | 'cerrado'
  cajeroNombre: string
  ventas: number
}

export type CorteZReporte = {
  fecha: string
  ventasTotales: number
  porMetodo: MetodoDesglose
  descuentosTotal: number
  cancelacionesTotal: number
  propinaEfectivo: number
  propinaTarjeta: number
  ticketPromedio: number
  mesasAtendidas: number
  pedidosCerrados: number
  turnos: TurnoDelDia[]
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

/** Fecha calendario 'YYYY-MM-DD' de hoy en America/Mexico_City */
function fechaHoyMX(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

/**
 * Rango UTC [desde, hasta) que cubre un día calendario completo en
 * America/Mexico_City. México eliminó el horario de verano en 2022 para
 * todo el país salvo la franja fronteriza norte (no aplica a Mexico_City),
 * por lo que la zona está fija en UTC-6 todo el año — seguro hardcodear
 * el offset sin depender de una librería de zonas horarias.
 */
function rangoUtcParaFechaMX(fecha: string): { desde: string; hasta: string } {
  const [y, m, d] = fecha.split('-').map(Number)
  const desde = new Date(Date.UTC(y, m - 1, d, 6, 0, 0))
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CorteZPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
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

  const { fecha: fechaParam } = await searchParams
  const fecha = fechaParam ?? fechaHoyMX()
  const { desde, hasta } = rangoUtcParaFechaMX(fecha)

  const [{ data: turnosDia }, { data: config }] = await Promise.all([
    supabase
      .from('turnos')
      .select('id, usuario_id, cerrado_por, fondo_inicial, abierto_en, cerrado_en, estado')
      .gte('abierto_en', desde)
      .lt('abierto_en', hasta)
      .order('abierto_en', { ascending: true }),
    supabase
      .from('config_sistema')
      .select(`
        impresion_activa,
        ticket_nombre, ticket_direccion, ticket_telefono, ticket_rfc,
        ticket_linea1, ticket_linea2, ticket_pie, ticket_pie2
      `)
      .eq('id', 1)
      .single(),
  ])

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
  const impresionActiva = (config as any)?.impresion_activa ?? false

  const turnos = turnosDia ?? []

  if (turnos.length === 0) {
    const reporteVacio: CorteZReporte = {
      fecha,
      ventasTotales: 0,
      porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0, mixto: 0 },
      descuentosTotal: 0,
      cancelacionesTotal: 0,
      propinaEfectivo: 0,
      propinaTarjeta: 0,
      ticketPromedio: 0,
      mesasAtendidas: 0,
      pedidosCerrados: 0,
      turnos: [],
    }
    return (
      <CorteZShell
        reporte={reporteVacio}
        ticketConfig={ticketConfig}
        impresionActiva={impresionActiva}
      />
    )
  }

  const turnoIds = turnos.map((t) => t.id)

  // ── Movimientos y pedidos de todos los turnos del día ────────────────────
  const [movimientosRes, pedidosRes] = await Promise.all([
    supabase
      .from('movimientos_caja')
      .select('id, turno_id, tipo, monto, propina, propina_efectivo, propina_tarjeta')
      .in('turno_id', turnoIds),
    supabase
      .from('pedidos')
      .select('id, turno_id, tipo, estado')
      .in('turno_id', turnoIds),
  ])

  const movimientos = movimientosRes.data ?? []
  const pedidos = pedidosRes.data ?? []
  const pedidoIds = pedidos.map((p) => p.id)

  const cobros = movimientos.filter((m) => m.tipo === 'cobro')
  const cobroIds = cobros.map((m) => m.id)

  // ── Pagos de los cobros (para desglose por método + detectar mixtos) ─────
  const { data: pagosData } =
    cobroIds.length > 0
      ? await supabase
          .from('pagos')
          .select('movimiento_id, metodo_pago, monto')
          .in('movimiento_id', cobroIds)
      : { data: [] as { movimiento_id: number; metodo_pago: string; monto: number }[] }
  const pagos = pagosData ?? []

  // ── Sub-pedidos del día (para acotar descuentos/cancelaciones) ───────────
  let subIds: number[] = []
  if (pedidoIds.length > 0) {
    const { data: subs } = await supabase.from('subpedidos').select('id').in('pedido_id', pedidoIds)
    subIds = (subs ?? []).map((s) => s.id)
  }

  const descuentosOr: string[] = []
  if (pedidoIds.length > 0) descuentosOr.push(`pedido_id.in.(${pedidoIds.join(',')})`)
  if (subIds.length > 0) descuentosOr.push(`subpedido_id.in.(${subIds.join(',')})`)

  const [{ data: descuentosData }, pedidoProductosCanceladosRes] = await Promise.all([
    descuentosOr.length > 0
      ? supabase.from('descuentos').select('monto_calculado').or(descuentosOr.join(','))
      : Promise.resolve({ data: [] as { monto_calculado: number }[] }),
    subIds.length > 0
      ? supabase.from('pedido_productos').select('id').in('subpedido_id', subIds).eq('estado', 'cancelado')
      : Promise.resolve({ data: [] as { id: number }[] }),
  ])

  const canceladoIds = (pedidoProductosCanceladosRes.data ?? []).map((p) => p.id)
  const { data: cancelacionesData } =
    canceladoIds.length > 0
      ? await supabase.from('cancelaciones').select('monto_afectado').in('pedido_producto_id', canceladoIds)
      : { data: [] as { monto_afectado: number }[] }

  // ── Nombres de cajeros (quien abrió / quien cerró cada turno) ────────────
  const usuarioIds = Array.from(
    new Set(
      turnos.flatMap((t) => [t.usuario_id, t.cerrado_por]).filter((id): id is string => !!id),
    ),
  )
  const { data: perfilesData } =
    usuarioIds.length > 0
      ? await supabase.from('perfiles').select('id, nombre').in('id', usuarioIds)
      : { data: [] as { id: string; nombre: string }[] }
  const nombrePorUsuario = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre]))

  // ── Totales del día ────────────────────────────────────────────────────
  const ventasTotales = cobros.reduce((s, m) => s + m.monto, 0)

  const propinaEfectivo = cobros.reduce(
    (s, m) => s + ((m as { propina_efectivo?: number }).propina_efectivo ?? 0),
    0,
  )
  const propinaTarjeta = cobros.reduce(
    (s, m) => s + ((m as { propina_tarjeta?: number }).propina_tarjeta ?? 0),
    0,
  )

  const descuentosTotal = (descuentosData ?? []).reduce((s, d) => s + d.monto_calculado, 0)
  const cancelacionesTotal = (cancelacionesData ?? []).reduce((s, c) => s + c.monto_afectado, 0)

  // Desglose por método: monto físico recibido (pagos.monto, incluye propina)
  // por cobro. Si un cobro combina más de un método, todo su monto va a
  // "mixto" en lugar de repartirse — así las 4 categorías son mutuamente
  // excluyentes y suman el total físico recibido en caja.
  const pagosPorMovimiento = new Map<number, { metodo_pago: string; monto: number }[]>()
  for (const p of pagos) {
    const arr = pagosPorMovimiento.get(p.movimiento_id) ?? []
    arr.push(p)
    pagosPorMovimiento.set(p.movimiento_id, arr)
  }

  const porMetodo: MetodoDesglose = { efectivo: 0, tarjeta: 0, transferencia: 0, mixto: 0 }
  for (const m of cobros) {
    const pagosDelMov = pagosPorMovimiento.get(m.id) ?? []
    if (pagosDelMov.length === 0) continue
    const montoFisico = pagosDelMov.reduce((s, p) => s + p.monto, 0)
    const metodosDistintos = new Set(pagosDelMov.map((p) => p.metodo_pago))
    if (metodosDistintos.size > 1) {
      porMetodo.mixto += montoFisico
    } else {
      const [metodo] = metodosDistintos
      if (metodo === 'efectivo') porMetodo.efectivo += montoFisico
      else if (metodo === 'tarjeta') porMetodo.tarjeta += montoFisico
      else if (metodo === 'transferencia') porMetodo.transferencia += montoFisico
    }
  }

  const pedidosCerrados = pedidos.filter((p) => p.estado === 'cerrado').length
  const ticketPromedio = pedidosCerrados > 0 ? ventasTotales / pedidosCerrados : 0

  // Mesas atendidas: número de pedidos tipo 'mesa' del día. No se usa
  // COUNT DISTINCT mesa_id porque pedidos.mesa_id queda NULL al cobrar una
  // mesa temporal ya liberada — cada pedido tipo 'mesa' representa una
  // atención real, se reutilice o no la misma mesa física varias veces.
  const mesasAtendidas = pedidos.filter((p) => p.tipo === 'mesa').length

  const ventasPorTurno = new Map<number, number>()
  for (const m of cobros) {
    ventasPorTurno.set(m.turno_id, (ventasPorTurno.get(m.turno_id) ?? 0) + m.monto)
  }

  const turnosDelDia: TurnoDelDia[] = turnos.map((t) => ({
    id: t.id,
    aperturaIso: t.abierto_en,
    cierreIso: t.cerrado_en,
    estado: t.estado,
    cajeroNombre: nombrePorUsuario.get(t.cerrado_por ?? t.usuario_id) ?? 'Desconocido',
    ventas: ventasPorTurno.get(t.id) ?? 0,
  }))

  const reporte: CorteZReporte = {
    fecha,
    ventasTotales,
    porMetodo,
    descuentosTotal,
    cancelacionesTotal,
    propinaEfectivo,
    propinaTarjeta,
    ticketPromedio,
    mesasAtendidas,
    pedidosCerrados,
    turnos: turnosDelDia,
  }

  return (
    <CorteZShell reporte={reporte} ticketConfig={ticketConfig} impresionActiva={impresionActiva} />
  )
}
