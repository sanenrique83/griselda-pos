import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'
import { MesasShell } from '@/components/mesas/MesasShell'
import { calcularOcupacionPorMesa } from '@/lib/asientos'
import { calcularAlertaVentasBajas, type FilaAlertaVentasBajas } from '@/lib/alertaVentasBajas'
import { primerNombreValido } from '@/lib/nombreUsuario'
import { colorSemaforoMesa } from '@/lib/colorMesa'
import { horaActualMX } from '@/lib/horarioDisponibilidad'

// Resumen operativo ("Panel del turno") — deliberadamente escopeado a mesas
// ocupadas (pedidos con mesa_id), no a para-llevar/mostrador, porque es lo
// que ya se carga en esta pantalla y es lo que el usuario ve en el plano de
// abajo. Snapshot al momento de la carga (no live-tick) — igual que el resto
// de esta página, que ya se recalcula por completo en cada navegación.
export type PanelTurno = {
  mesasOcupadas: number
  clientes: number
  ticketPromedio: number
  tiempoPromedioMin: number
  cobroPendiente: number
}

function saludoPorHora(horaActual: string): string {
  const hora = Number(horaActual.split(':')[0])
  if (hora >= 5 && hora < 12) return 'Buen día'
  if (hora >= 12 && hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// Tipos exportados para que los componentes cliente los importen
export type MesaUI = {
  id: number
  numero: number
  nombre: string | null
  capacidad: number | null
  area_id: number | null
  area_nombre: string
  area_orden: number
  pos_x: number | null
  pos_y: number | null
  rotacion: number
  forma: FormaMesa
  tamano: TamanoMesa
  asientos_horario: boolean
  fuera_de_servicio: boolean
  // Cuántos de los asientos de ESTA mesa física están tomados (repartidos
  // desde la cadena si la mesa está unida — ver calcularOcupacionPorMesa).
  ocupadas: number
  pedido_activo: {
    id: number
    created_at: string
    num_comensales: number
    mesero_nombre: string
    algunoPagadoNoTodos: boolean
    tieneProductos: boolean
    precuentaImpresaEn: string | null
  } | null
}

export type GrupoArea = {
  area_nombre: string
  mesas: MesaUI[]
}

export default async function MesasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Rol del usuario en sesión — la alerta de ventas bajas (F9-06) es una
  // señal de negocio que solo el admin puede accionar (comp, staff, checar
  // equipo); un mesero no tiene nada que hacer con ese dato, así que se
  // oculta para ese rol aunque /mesas sea la pantalla donde más tiempo pasa
  // durante el servicio.
  const { data: perfilPropio } = await supabase
    .from('perfiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single()
  const esAdmin = perfilPropio?.rol === 'admin'
  const nombreUsuario = primerNombreValido(perfilPropio?.nombre).split(' ')[0]

  // Turno activo
  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()

  // Mesas activas con su área
  const { data: mesasRaw } = await supabase
    .from('mesas')
    .select(
      'id, numero, nombre, capacidad, area_id, pos_x, pos_y, rotacion, forma, tamano, asientos_horario, fuera_de_servicio, areas(nombre, orden)',
    )
    .eq('activa', true)
    .order('numero')

  // Pedidos abiertos en mesa (no llevar) — mesa "principal" de cada uno
  const { data: pedidosAbiertos } = await supabase
    .from('pedidos')
    .select('id, mesa_id, created_at, num_comensales, mesero_id, precuenta_impresa_en')
    .eq('estado', 'abierto')
    .not('mesa_id', 'is', null)

  // Mesas satélite unidas de forma persistente (unirMesas) a esos mismos
  // pedidos abiertos — una mesa satélite ya no tiene su propio pedidos.mesa_id
  // (su pedido original se cerró al unirse), así que sin esto se vería como
  // libre pese a seguir ocupada como parte del pedido destino.
  const pedidoIdsAbiertos = (pedidosAbiertos ?? []).map((p) => p.id)
  const [{ data: pedidoMesasRaw }, { data: subpedidosRaw }, { data: config }, alertaVentasBajasRes] =
    await Promise.all([
      pedidoIdsAbiertos.length > 0
        ? supabase.from('pedido_mesas').select('mesa_id, pedido_id, orden').in('pedido_id', pedidoIdsAbiertos)
        : Promise.resolve({ data: [] as { mesa_id: number; pedido_id: number; orden: number }[] }),
      pedidoIdsAbiertos.length > 0
        ? supabase
            .from('subpedidos')
            .select('pedido_id, estado, silla_numero, pedido_productos(estado, cantidad, precio_unit)')
            .in('pedido_id', pedidoIdsAbiertos)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('config_sistema')
        .select(
          'alerta_mesa_sin_atender, alerta_mesa_sin_atender_minutos, tiempo_mesa_alerta_minutos, alerta_ventas_bajas_activa, alerta_ventas_bajas_umbral_pct, alerta_precuenta_activa, alerta_precuenta_minutos',
        )
        .eq('id', 1)
        .single(),
      // Solo tiene sentido pedirla si hay turno activo y quien mira es admin
      // (ver comentario de esAdmin arriba) — nunca se corre en vano.
      esAdmin && turno
        ? supabase.rpc('dashboard_alerta_ventas_bajas')
        : Promise.resolve({ data: null as FilaAlertaVentasBajas[] | null }),
    ])

  const alertaVentasBajas = calcularAlertaVentasBajas(config, alertaVentasBajasRes.data?.[0])

  // Nombres de los meseros en esos pedidos
  const meseroIds = [...new Set((pedidosAbiertos ?? []).map((p) => p.mesero_id))]
  const { data: perfiles } = meseroIds.length
    ? await supabase.from('perfiles').select('id, nombre').in('id', meseroIds)
    : { data: [] }

  const perfilMap = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string]))
  const pedidoPorId = new Map((pedidosAbiertos ?? []).map((p) => [p.id, p]))

  // ── Ocupación de sillas (individual o repartida en cadena) ────────────────
  const capacidadPorMesa = new Map(
    (mesasRaw ?? []).map((m) => [m.id, m.capacidad ?? 1]),
  )
  const sillasOcupadasPorPedido = new Map<number, number[]>()
  const algunoPagadoNoTodosPorPedido = new Map<number, boolean>()
  const tieneProductosPorPedido = new Map<number, boolean>()
  for (const sub of subpedidosRaw ?? []) {
    if (sub.silla_numero !== null) {
      const arr = sillasOcupadasPorPedido.get(sub.pedido_id) ?? []
      arr.push(sub.silla_numero)
      sillasOcupadasPorPedido.set(sub.pedido_id, arr)
    }
    const tieneAlgunoActivo = (sub.pedido_productos ?? []).some(
      (pp: any) => pp.estado === 'pendiente' || pp.estado === 'enviado',
    )
    if (tieneAlgunoActivo) tieneProductosPorPedido.set(sub.pedido_id, true)
  }
  // algunoPagadoNoTodos: al menos un subpedido 'pagado' y al menos uno que no.
  const subsPorPedido = new Map<number, { estado: string }[]>()
  for (const sub of subpedidosRaw ?? []) {
    const arr = subsPorPedido.get(sub.pedido_id) ?? []
    arr.push({ estado: sub.estado })
    subsPorPedido.set(sub.pedido_id, arr)
  }
  for (const [pedidoId, subs] of subsPorPedido) {
    const algunoPagado = subs.some((s) => s.estado === 'pagado')
    const todosPagados = subs.every((s) => s.estado === 'pagado')
    algunoPagadoNoTodosPorPedido.set(pedidoId, algunoPagado && !todosPagados)
  }

  // ── Panel del turno (resumen operativo) ────────────────────────────────────
  const totalPorPedido = new Map<number, number>()
  let cobroPendiente = 0
  for (const sub of subpedidosRaw ?? []) {
    const totalSub = (sub.pedido_productos ?? [])
      .filter((pp: any) => pp.estado !== 'cancelado')
      .reduce((s: number, pp: any) => s + pp.cantidad * pp.precio_unit, 0)
    totalPorPedido.set(sub.pedido_id, (totalPorPedido.get(sub.pedido_id) ?? 0) + totalSub)
    // Cobro pendiente: valor de lo que aún no se ha cobrado (subpedidos que
    // siguen 'activo', no 'pagado') entre las mesas ocupadas ahorita.
    if (sub.estado === 'activo') cobroPendiente += totalSub
  }
  const clientes = (pedidosAbiertos ?? []).reduce((s, p) => s + p.num_comensales, 0)
  const ahoraMs = Date.now()
  const tiempoPromedioMin =
    (pedidosAbiertos ?? []).length > 0
      ? (pedidosAbiertos ?? []).reduce(
          (s, p) => s + (ahoraMs - new Date(p.created_at).getTime()) / 60_000,
          0,
        ) / (pedidosAbiertos ?? []).length
      : 0
  const ticketPromedio =
    (pedidosAbiertos ?? []).length > 0
      ? (pedidosAbiertos ?? []).reduce((s, p) => s + (totalPorPedido.get(p.id) ?? 0), 0) /
        (pedidosAbiertos ?? []).length
      : 0
  const panelTurno: PanelTurno = {
    mesasOcupadas: (pedidosAbiertos ?? []).length,
    clientes,
    ticketPromedio,
    tiempoPromedioMin: Math.round(tiempoPromedioMin),
    cobroPendiente,
  }

  // Campana de notificaciones del header — cuenta real de pedidos en mesa
  // en rojo (sin atender por tiempo) al momento de la carga, no un contador
  // inventado. Por pedido, no por mesa física, para no contar dos veces una
  // mesa unida (misma alerta se repetiría en cada mesa satélite).
  const campanaCount = (pedidosAbiertos ?? []).filter(
    (p) =>
      colorSemaforoMesa(
        {
          ocupada: true,
          algunoPagadoNoTodos: algunoPagadoNoTodosPorPedido.get(p.id) ?? false,
          tieneProductos: tieneProductosPorPedido.get(p.id) ?? false,
          pedidoCreatedAt: p.created_at,
          alertaActiva: config?.alerta_mesa_sin_atender ?? true,
          alertaMinutos: config?.alerta_mesa_sin_atender_minutos ?? 10,
          fueraDeServicio: false,
        },
        ahoraMs,
      ) === 'rojo',
  ).length

  const ocupacionPorMesa = calcularOcupacionPorMesa({
    pedidos: (pedidosAbiertos ?? [])
      .filter((p): p is typeof p & { mesa_id: number } => p.mesa_id !== null)
      .map((p) => ({ id: p.id, mesaId: p.mesa_id })),
    pedidoMesas: (pedidoMesasRaw ?? []).map((pm) => ({
      pedidoId: pm.pedido_id,
      mesaId: pm.mesa_id,
      orden: pm.orden,
    })),
    capacidadPorMesa,
    sillasOcupadasPorPedido,
  })

  // mesa_id → pedido que la ocupa, ya sea como principal o como satélite.
  // Dos mesas comparten el mismo pedido_activo.id cuando están unidas — esa
  // es la clave de agrupación que usa el conector visual en PlanoMesas.
  const pedidoMap = new Map((pedidosAbiertos ?? []).map((p) => [p.mesa_id as number, p]))
  for (const pm of pedidoMesasRaw ?? []) {
    const pedido = pedidoPorId.get(pm.pedido_id)
    if (pedido) pedidoMap.set(pm.mesa_id, pedido)
  }

  // Deduplicar por id (PostgREST puede devolver la misma fila dos veces con embeds)
  const mesasUnicas = [
    ...new Map((mesasRaw ?? []).map((m) => [m.id, m])).values(),
  ]

  // Agrupar mesas por área (vista de lista) y armar lista plana (vista de mapa)
  const gruposMap = new Map<string, MesaUI[]>()
  const mesas: MesaUI[] = []

  for (const mesa of mesasUnicas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const area_nombre = (mesa.areas as any)?.nombre ?? 'Sin área'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const area_orden = (mesa.areas as any)?.orden ?? 0
    const pedido = pedidoMap.get(mesa.id)

    const mesaUI: MesaUI = {
      id: mesa.id,
      numero: mesa.numero,
      nombre: mesa.nombre,
      capacidad: mesa.capacidad,
      area_id: mesa.area_id,
      area_nombre,
      area_orden,
      pos_x: mesa.pos_x,
      pos_y: mesa.pos_y,
      rotacion: mesa.rotacion ?? 0,
      forma: (mesa.forma as FormaMesa) ?? 'rectangulo',
      tamano: (mesa.tamano as TamanoMesa) ?? 'medio',
      asientos_horario: mesa.asientos_horario ?? true,
      fuera_de_servicio: mesa.fuera_de_servicio ?? false,
      ocupadas: ocupacionPorMesa.get(mesa.id) ?? 0,
      pedido_activo: pedido
        ? {
            id: pedido.id,
            created_at: pedido.created_at,
            num_comensales: pedido.num_comensales,
            mesero_nombre: primerNombreValido(perfilMap.get(pedido.mesero_id)),
            algunoPagadoNoTodos: algunoPagadoNoTodosPorPedido.get(pedido.id) ?? false,
            tieneProductos: tieneProductosPorPedido.get(pedido.id) ?? false,
            precuentaImpresaEn: pedido.precuenta_impresa_en ?? null,
          }
        : null,
    }

    if (!gruposMap.has(area_nombre)) gruposMap.set(area_nombre, [])
    gruposMap.get(area_nombre)!.push(mesaUI)
    mesas.push(mesaUI)
  }

  const grupos: GrupoArea[] = Array.from(gruposMap.entries()).map(
    ([area_nombre, mesas]) => ({ area_nombre, mesas }),
  )

  const hayMapa = mesas.some((m) => m.pos_x !== null && m.pos_y !== null)

  return (
    <MesasShell
      grupos={grupos}
      mesas={mesas}
      hayMapa={hayMapa}
      turnoId={turno?.id ?? null}
      alertaActiva={config?.alerta_mesa_sin_atender ?? true}
      alertaMinutos={config?.alerta_mesa_sin_atender_minutos ?? 10}
      tiempoMesaAlertaMinutos={config?.tiempo_mesa_alerta_minutos ?? 60}
      alertaVentasBajas={alertaVentasBajas}
      alertaPrecuentaActiva={config?.alerta_precuenta_activa ?? true}
      alertaPrecuentaMinutos={config?.alerta_precuenta_minutos ?? 5}
      nombreUsuario={nombreUsuario}
      saludo={saludoPorHora(horaActualMX())}
      panelTurno={panelTurno}
      campanaCount={campanaCount}
    />
  )
}
