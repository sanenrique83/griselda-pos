import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import type {
  VentaHora,
  TopProducto,
  MetodoPagoData,
  TipoPedidoData,
  VentaPorDiaSemana,
  TicketPorTipoData,
  TiempoServicioData,
  CancelacionesData,
  DescuentosData,
  TurnoRecienteData,
  RendimientoPunto,
  RendimientoRecetaData,
  PersonaMonto,
} from '@/components/dashboard/DashboardCharts'

// ─── Fechas de temporada alta (puentes / fines de semana largo) ──────────────
const FECHAS_TEMPORADA_ALTA: string[] = [
  // 2025
  '2025-01-01', // Año Nuevo
  '2025-02-01', '2025-02-02', '2025-02-03', // puente Constitución
  '2025-03-15', '2025-03-16', '2025-03-17', // puente Natalicio de Juárez
  '2025-04-13', '2025-04-14', '2025-04-15', '2025-04-16', '2025-04-17', '2025-04-18', '2025-04-19', '2025-04-20', // Semana Santa
  '2025-05-01', // Día del Trabajo
  '2025-09-13', '2025-09-14', '2025-09-15', '2025-09-16', // puente Independencia
  '2025-11-01', '2025-11-02', // Día de Muertos
  '2025-11-15', '2025-11-16', '2025-11-17', // puente Revolución
  '2025-12-24', '2025-12-25', // Navidad

  // 2026
  '2026-01-31', '2026-02-01', '2026-02-02', // puente Constitución
  '2026-03-14', '2026-03-15', '2026-03-16', // puente Juárez
  '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05', // Semana Santa
  '2026-05-01', // Día del Trabajo
  '2026-07-24', // Día Nacional del Tequila (nueva fecha fija desde 2026)
  '2026-09-14', '2026-09-15', '2026-09-16', // puente Independencia
  '2026-11-01', '2026-11-02', // Día de Muertos
  '2026-11-14', '2026-11-15', '2026-11-16', // puente Revolución
  '2026-12-24', '2026-12-25', // Navidad
]

// Índice = EXTRACT(DOW) de Postgres: 0=domingo … 6=sábado
const DIAS_SEMANA_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ─── Helpers de formato ───────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

/** Fecha calendario 'YYYY-MM-DD' en America/Mexico_City */
function fechaMX(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

/** Fecha + hora corta, ej. "26 jul 14:32" (America/Mexico_City) */
function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

/** Fecha corta ej. "26 jul", a partir de una columna DATE ('YYYY-MM-DD') —
 * se arma en UTC y se formatea en UTC para no correr el día por huso horario
 * (una columna DATE no tiene componente de hora que convertir). */
function fmtFechaCorta(fechaISO: string) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
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

  if (perfil?.rol !== 'admin') redirect('/mesas')

  // ── Hora de actualización ──────────────────────────────────────────────────
  const ahora = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })

  // ── Turno activo ──────────────────────────────────────────────────────────
  const { data: turno } = await supabase
    .from('turnos')
    .select('id, fondo_inicial, abierto_en')
    .eq('estado', 'abierto')
    .order('abierto_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Mesas activas ─────────────────────────────────────────────────────────
  const { count: mesasActivas } = await supabase
    .from('mesas')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'ocupada')

  // ── Margen por producto (costeo de catálogo, independiente del turno) ─────
  const { data: margenRaw } = await supabase.rpc('margen_productos')
  const margenes: MargenProducto[] = (margenRaw ?? []).map((r: any) => ({
    productoId: r.producto_id,
    nombre: r.nombre,
    esCombo: r.es_combo,
    precio: r.precio,
    costo: r.costo,
    costoCompleto: r.costo_completo,
    margen: r.margen,
    margenPct: r.margen_pct,
    margenVariable: r.margen_variable ?? false,
  }))

  // ── Insumos bajo stock mínimo (independiente del turno) ───────────────────
  const { data: insumosRaw } = await supabase
    .from('insumos')
    .select('id, nombre, unidad_medida, stock_actual, stock_minimo')
    .eq('activo', true)

  const insumosBajoStock: InsumoBajoStock[] = (insumosRaw ?? [])
    .filter((i: any) => i.stock_actual < i.stock_minimo)
    .map((i: any) => ({
      id: i.id,
      nombre: i.nombre,
      unidadMedida: i.unidad_medida,
      stockActual: i.stock_actual,
      stockMinimo: i.stock_minimo,
    }))
    .sort((a, b) => (a.stockActual - a.stockMinimo) - (b.stockActual - b.stockMinimo))

  // ── Porciones bajas — producción por lotes (independiente del turno) ──────
  // Compara porciones_disponibles contra el consumo promedio diario de los
  // últimos 14 días, reconstruido desde ventas reales (pedido_productos).
  const { data: consumoLoteRaw } = await supabase.rpc('consumo_diario_recetas_lote', { p_dias: 14 })
  const porcionesBajas: PorcionesBajas[] = (consumoLoteRaw ?? [])
    .map((r: any) => ({
      recetaId: r.receta_id,
      recetaNombre: r.receta_nombre,
      porcionesDisponibles: r.porciones_disponibles,
      consumoPromedioDiario: r.consumo_promedio_diario,
    }))
    .filter((r: PorcionesBajas) => r.consumoPromedioDiario > 0 && r.porcionesDisponibles < r.consumoPromedioDiario)
    .sort(
      (a: PorcionesBajas, b: PorcionesBajas) =>
        (a.porcionesDisponibles - a.consumoPromedioDiario) - (b.porcionesDisponibles - b.consumoPromedioDiario),
    )

  if (!turno) {
    return (
      <div>
        <Header titulo="Dashboard" subtitulo="Sin turno activo" ahora={ahora} />
        <div className="px-4 py-4 space-y-4">
          <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-4">
            <p className="text-sm font-semibold text-amber-800">No hay turno abierto</p>
            <p className="mt-1 text-xs text-amber-600">
              Ve a Más → Turno para iniciar el turno del día.
            </p>
          </div>
          <MetricCard
            label="Mesas activas ahora"
            value={String(mesasActivas ?? 0)}
            unit="mesas"
            color="violet"
          />
          <InsumosBajoStockCard insumos={insumosBajoStock} />
          <PorcionesBajasCard porciones={porcionesBajas} />
          <MargenProductosCard margenes={margenes} />
        </div>
      </div>
    )
  }

  const ahoraDate = new Date()

  // ─────────────────────────────────────────────────────────────────────────
  // Queries del turno activo
  // ─────────────────────────────────────────────────────────────────────────

  const [movimientosRes, pedidosCerradosRes, pedidosActivosRes, pedidoIdsRes, turnosRecientesRes] =
    await Promise.all([
      supabase
        .from('movimientos_caja')
        .select('id, tipo, monto, propina, created_at')
        .eq('turno_id', turno.id),
      supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('turno_id', turno.id)
        .eq('estado', 'cerrado'),
      supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('turno_id', turno.id)
        .eq('estado', 'abierto'),
      supabase
        .from('pedidos')
        .select('id, tipo, estado, created_at, cerrado_en')
        .eq('turno_id', turno.id),
      // Últimos 10 turnos cerrados (de cualquier turno, no solo el actual) —
      // acotado explícitamente con order+limit en SQL, nunca traído completo.
      supabase
        .from('turnos')
        .select('id, cerrado_en, diferencia, cerrado_por')
        .eq('estado', 'cerrado')
        .order('cerrado_en', { ascending: false })
        .limit(10),
    ])

  const movimientos = movimientosRes.data ?? []
  const pedidosCerrados = pedidosCerradosRes.count ?? 0
  const pedidosAbiertos = pedidosActivosRes.count ?? 0
  const pedidosData = pedidoIdsRes.data ?? []
  const pedidoIds = pedidosData.map((p: any) => p.id)
  const turnosRecientesRaw = turnosRecientesRes.data ?? []

  // Sub-pedidos del turno — compartido por top productos, cancelaciones y descuentos.
  let subIds: number[] = []
  if (pedidoIds.length > 0) {
    const { data: subs } = await supabase.from('subpedidos').select('id').in('pedido_id', pedidoIds)
    subIds = (subs ?? []).map((s: any) => s.id)
  }

  // Fecha calendario (America/Mexico_City) exactamente 7 días antes de hoy,
  // para el comparativo "vs. mismo día de la semana hace 7 días".
  const fechaHace7 = (() => {
    const [y, m, d] = fechaMX(ahoraDate.toISOString()).split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 7)
    return dt.toISOString().slice(0, 10)
  })()

  // Filtro OR (pedido_id / subpedido_id) para descuentos, ambos ya acotados al turno
  const descuentosOr: string[] = []
  if (pedidoIds.length > 0) descuentosOr.push(`pedido_id.in.(${pedidoIds.join(',')})`)
  if (subIds.length > 0) descuentosOr.push(`subpedido_id.in.(${subIds.join(',')})`)

  // Pagos del turno + desglose de cobros por sub-pedido (para ticket por tipo)
  // + pedido_productos cancelados y descuentos del turno (para las secciones nuevas)
  // + reportes históricos agregados en SQL (RPC) — nunca se trae el histórico
  // completo de turnos/movimientos al frontend.
  const cobroIds = movimientos.filter((m) => m.tipo === 'cobro').map((m) => m.id)
  const [
    pagosRes,
    cobroSubpedidosRes,
    turnoSemanaAnteriorRes,
    ventasPorDiaSemanaRes,
    temporadaAltaRes,
    pedidoProductosCanceladosRes,
    descuentosRes,
  ] = await Promise.all([
    cobroIds.length > 0
      ? supabase.from('pagos').select('movimiento_id, metodo_pago, monto').in('movimiento_id', cobroIds)
      : Promise.resolve({ data: [] as { movimiento_id: number; metodo_pago: string; monto: number }[] }),
    cobroIds.length > 0
      ? supabase
          .from('cobro_subpedidos')
          .select('monto_aplicado, subpedidos(pedido_id)')
          .in('movimiento_id', cobroIds)
      : Promise.resolve({ data: [] as { monto_aplicado: number; subpedidos: { pedido_id: number } | null }[] }),
    supabase.rpc('dashboard_turno_por_fecha', { p_fecha: fechaHace7 }),
    supabase.rpc('dashboard_ventas_promedio_dia_semana'),
    supabase.rpc('dashboard_temporada_alta', { p_fechas: FECHAS_TEMPORADA_ALTA }),
    subIds.length > 0
      ? supabase
          .from('pedido_productos')
          .select('id')
          .in('subpedido_id', subIds)
          .eq('estado', 'cancelado')
      : Promise.resolve({ data: [] as { id: number }[] }),
    descuentosOr.length > 0
      ? supabase.from('descuentos').select('tipo, monto_calculado, usuario_id').or(descuentosOr.join(','))
      : Promise.resolve({ data: [] as { tipo: string; monto_calculado: number; usuario_id: string | null }[] }),
  ])

  const pagos = pagosRes.data ?? []

  // Total cobrado por pedido (para ticket por tipo y tiempo de servicio)
  const totalPorPedido = new Map<number, number>()
  for (const cs of cobroSubpedidosRes.data ?? []) {
    const pedidoId = (cs as any).subpedidos?.pedido_id
    if (!pedidoId) continue
    totalPorPedido.set(pedidoId, (totalPorPedido.get(pedidoId) ?? 0) + (cs as any).monto_aplicado)
  }

  // Cancelaciones del turno (dependen de los pedido_producto cancelados de arriba)
  const canceladoIds = (pedidoProductosCanceladosRes.data ?? []).map((p: any) => p.id)
  const { data: cancelacionesRaw } =
    canceladoIds.length > 0
      ? await supabase
          .from('cancelaciones')
          .select('motivo, monto_afectado, usuario_id')
          .in('pedido_producto_id', canceladoIds)
      : { data: [] as { motivo: string; monto_afectado: number; usuario_id: string | null }[] }

  // Nombres de meseros/admins involucrados en cancelaciones, descuentos y
  // quién cerró cada uno de los últimos 10 turnos (una sola query combinada).
  const usuarioIds = Array.from(
    new Set(
      [
        ...(cancelacionesRaw ?? []).map((c) => c.usuario_id),
        ...(descuentosRes.data ?? []).map((d: any) => d.usuario_id),
        ...turnosRecientesRaw.map((t) => t.cerrado_por),
      ].filter((id): id is string => !!id),
    ),
  )
  const { data: perfilesData } =
    usuarioIds.length > 0
      ? await supabase.from('perfiles').select('id, nombre').in('id', usuarioIds)
      : { data: [] as { id: string; nombre: string }[] }
  const nombrePorUsuario = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre]))
  const nombreMesero = (usuarioId: string | null) =>
    usuarioId ? nombrePorUsuario.get(usuarioId) ?? 'Desconocido' : 'Sin usuario'

  // cerrado_por: NULL en turnos cerrados antes de que se empezara a registrar.
  const turnosRecientes: TurnoRecienteData[] = turnosRecientesRaw.map((t) => ({
    id: t.id,
    fechaCierre: t.cerrado_en ? fmtFechaHora(t.cerrado_en) : '—',
    diferencia: t.diferencia,
    cerradoPor: t.cerrado_por ? nombreMesero(t.cerrado_por) : 'Sin registrar',
  }))

  // ── Totales ──────────────────────────────────────────────────────────────
  const totalCobrado = movimientos
    .filter((m) => m.tipo === 'cobro')
    .reduce((s, m) => s + m.monto, 0)

  const porMetodo = (pagos ?? []).reduce(
    (acc, p) => {
      if (p.metodo_pago === 'efectivo') acc.efectivo += p.monto
      else if (p.metodo_pago === 'tarjeta') acc.tarjeta += p.monto
      else if (p.metodo_pago === 'transferencia') acc.transferencia += p.monto
      return acc
    },
    { efectivo: 0, tarjeta: 0, transferencia: 0 },
  )

  // Propina por método: cobros de un solo método → toda la propina a ese método.
  // Cobros mixtos → se reparte proporcional al monto pagado por cada método.
  const pagosPorMovimiento = new Map<number, { metodo_pago: string; monto: number }[]>()
  for (const p of pagos) {
    const arr = pagosPorMovimiento.get(p.movimiento_id) ?? []
    arr.push(p)
    pagosPorMovimiento.set(p.movimiento_id, arr)
  }

  const propinaAcumulada = { efectivo: 0, tarjeta: 0, transferencia: 0 }
  for (const m of movimientos) {
    if (m.tipo !== 'cobro' || !m.propina) continue
    const pagosDelMov = pagosPorMovimiento.get(m.id) ?? []
    const totalPagosMov = pagosDelMov.reduce((s, p) => s + p.monto, 0)
    if (totalPagosMov <= 0) continue
    for (const p of pagosDelMov) {
      const share = p.monto / totalPagosMov
      if (p.metodo_pago === 'efectivo') propinaAcumulada.efectivo += m.propina * share
      else if (p.metodo_pago === 'tarjeta') propinaAcumulada.tarjeta += m.propina * share
      else if (p.metodo_pago === 'transferencia') propinaAcumulada.transferencia += m.propina * share
    }
  }

  const promedioTicket = pedidosCerrados > 0 ? totalCobrado / pedidosCerrados : 0

  // ── Top 10 productos (con desglose por variante/modificador) ─────────────
  // También alimenta el desglose por categoría (F9-05) y por zona de
  // preparación (F9-05), del mismo turno — sin query adicional.
  let topProductos: TopProducto[] = []
  let ventasPorCategoria: PersonaMonto[] = []
  let ventasPorZona: PersonaMonto[] = []

  if (subIds.length > 0) {
    const { data: rawProds } = await supabase
      .from('pedido_productos')
      .select(
        'cantidad, precio_unit, productos(id, nombre, emoji, categorias(nombre, grupos_impresora(nombre))), pedido_producto_opciones(precio_extra, opciones_modificador(nombre))',
      )
      .in('subpedido_id', subIds)
      .neq('estado', 'cancelado')

    const topMap = new Map<number, TopProducto>()
    // variantesMap: producto_id -> Map<nombreVariante, {vendidos, total}>
    const variantesMap = new Map<number, Map<string, { vendidos: number; total: number }>>()
    const categoriaMap = new Map<string, { count: number; monto: number }>()
    const zonaMap = new Map<string, { count: number; monto: number }>()

    for (const pp of rawProds ?? []) {
      const prod = (pp as any).productos
      if (!prod) continue
      const opciones = (pp as any).pedido_producto_opciones ?? []
      const extras = opciones.reduce((s: number, o: any) => s + o.precio_extra, 0)
      const cantidad = (pp as any).cantidad
      const lineTotal = ((pp as any).precio_unit + extras) * cantidad

      const entry = topMap.get(prod.id) ?? {
        nombre: prod.nombre,
        emoji: prod.emoji,
        vendidos: 0,
        total: 0,
        variantes: [],
      }
      topMap.set(prod.id, {
        ...entry,
        vendidos: entry.vendidos + cantidad,
        total: entry.total + lineTotal,
      })

      // Nombre de la variante: modificadores elegidos, ordenados; "Sencillo" si no eligió ninguno
      const nombresOpciones = opciones
        .map((o: any) => o.opciones_modificador?.nombre)
        .filter(Boolean)
        .sort()
      const varianteNombre = nombresOpciones.length > 0 ? nombresOpciones.join(' + ') : 'Sencillo'

      const varMap = variantesMap.get(prod.id) ?? new Map<string, { vendidos: number; total: number }>()
      const varEntry = varMap.get(varianteNombre) ?? { vendidos: 0, total: 0 }
      varMap.set(varianteNombre, {
        vendidos: varEntry.vendidos + cantidad,
        total: varEntry.total + lineTotal,
      })
      variantesMap.set(prod.id, varMap)

      // Por categoría (F9-05)
      const categoriaNombre = prod.categorias?.nombre ?? 'Sin categoría'
      const catEntry = categoriaMap.get(categoriaNombre) ?? { count: 0, monto: 0 }
      categoriaMap.set(categoriaNombre, {
        count: catEntry.count + cantidad,
        monto: catEntry.monto + lineTotal,
      })

      // Por zona de preparación (F9-05) — categorías.grupo_impresora_id
      const zonaNombre = prod.categorias?.grupos_impresora?.nombre ?? 'Sin zona asignada'
      const zonaEntry = zonaMap.get(zonaNombre) ?? { count: 0, monto: 0 }
      zonaMap.set(zonaNombre, {
        count: zonaEntry.count + cantidad,
        monto: zonaEntry.monto + lineTotal,
      })
    }

    topProductos = [...topMap.entries()]
      .map(([prodId, p]) => {
        const varMap = variantesMap.get(prodId)
        const variantes = varMap
          ? [...varMap.entries()]
              .map(([nombre, v]) => ({ nombre, vendidos: v.vendidos, total: v.total }))
              .sort((a, b) => b.vendidos - a.vendidos)
          : []
        // Si solo hay una variante ("Sencillo" o una sola opción), no aporta desglosar
        return { ...p, variantes: variantes.length > 1 ? variantes : [] }
      })
      .sort((a, b) => b.vendidos - a.vendidos)
      .slice(0, 10)

    ventasPorCategoria = [...categoriaMap.entries()]
      .map(([nombre, v]) => ({ nombre, count: v.count, monto: v.monto }))
      .sort((a, b) => b.monto - a.monto)

    ventasPorZona = [...zonaMap.entries()]
      .map(([nombre, v]) => ({ nombre, count: v.count, monto: v.monto }))
      .sort((a, b) => b.monto - a.monto)
  }

  // ── Ventas por franja horaria ─────────────────────────────────────────────
  const cobrosConHora = movimientos.filter((m) => m.tipo === 'cobro')
  const abiertaEn = new Date(turno.abierto_en)

  // Generar todas las horas desde apertura hasta ahora
  const horaInicio = abiertaEn.getHours()
  const horaFin = ahoraDate.getHours()
  const horasMap = new Map<number, number>()

  for (let h = horaInicio; h <= horaFin; h++) {
    horasMap.set(h, 0)
  }

  for (const cobro of cobrosConHora) {
    const horaLocal = new Date(cobro.created_at).toLocaleString('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Mexico_City',
    })
    const h = parseInt(horaLocal)
    if (!isNaN(h)) {
      horasMap.set(h, (horasMap.get(h) ?? 0) + cobro.monto)
    }
  }

  const ventasPorHora: VentaHora[] = [...horasMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, total]) => ({
      hora: `${String(h).padStart(2, '0')}h`,
      total,
    }))

  // ── Mesa vs para llevar vs mostrador ───────────────────────────────────────
  const mesaCount = pedidosData.filter((p: any) => p.tipo === 'mesa').length
  const llevarCount = pedidosData.filter((p: any) => p.tipo === 'llevar').length
  const mostradorCount = pedidosData.filter((p: any) => p.tipo === 'mostrador').length

  // ── (1) Comparativo vs. mismo día de la semana hace 7 días (RPC) ──────────
  const filaSemanaAnterior = (turnoSemanaAnteriorRes.data as
    | { turno_id: number; total_cobrado: number }[]
    | null)?.[0]
  const totalCobradoAnterior = filaSemanaAnterior ? filaSemanaAnterior.total_cobrado : null

  // ── (2) Ventas promedio por día de semana, últimos 8 turnos c/u (RPC) ──────
  const promedioPorDow = new Map<number, { promedio: number; turnos: number }>()
  for (const row of (ventasPorDiaSemanaRes.data as
    | { dia_semana: number; promedio: number; turnos_contados: number }[]
    | null) ?? []) {
    promedioPorDow.set(row.dia_semana, { promedio: row.promedio, turnos: row.turnos_contados })
  }

  const ventasPorDiaSemana: VentaPorDiaSemana[] = DIAS_SEMANA_LABEL.map((label, dow) => {
    const r = promedioPorDow.get(dow)
    return { dia: label, promedio: r?.promedio ?? 0, turnos: r?.turnos ?? 0 }
  })

  // ── (3) Ticket promedio: mesa vs. llevar vs. mostrador (cerrados del turno) ──
  let sumMesa = 0, countMesaCerrados = 0
  let sumLlevar = 0, countLlevarCerrados = 0
  let sumMostrador = 0, countMostradorCerrados = 0
  for (const p of pedidosData as any[]) {
    if (p.estado !== 'cerrado') continue
    const total = totalPorPedido.get(p.id) ?? 0
    if (p.tipo === 'mesa') {
      sumMesa += total
      countMesaCerrados++
    } else if (p.tipo === 'llevar') {
      sumLlevar += total
      countLlevarCerrados++
    } else if (p.tipo === 'mostrador') {
      sumMostrador += total
      countMostradorCerrados++
    }
  }

  const ticketPorTipo: TicketPorTipoData = {
    mesa: { promedio: countMesaCerrados > 0 ? sumMesa / countMesaCerrados : 0, count: countMesaCerrados },
    llevar: { promedio: countLlevarCerrados > 0 ? sumLlevar / countLlevarCerrados : 0, count: countLlevarCerrados },
    mostrador: {
      promedio: countMostradorCerrados > 0 ? sumMostrador / countMostradorCerrados : 0,
      count: countMostradorCerrados,
    },
  }

  // ── (4) Temporada alta vs. mismo día de semana en fecha normal (RPC) ──────
  const filaTemporadaAlta = (temporadaAltaRes.data as
    | {
        promedio_alta: number | null
        turnos_alta: number
        promedio_normal: number | null
        turnos_normal: number
      }[]
    | null)?.[0]

  const temporadaAlta = {
    promedioAlta: filaTemporadaAlta?.promedio_alta ?? null,
    promedioNormal: filaTemporadaAlta?.promedio_normal ?? null,
    fechasAlta: filaTemporadaAlta?.turnos_alta ?? 0,
    fechasNormal: filaTemporadaAlta?.turnos_normal ?? 0,
  }

  // ── (5) Tiempo promedio apertura → cobro, pedidos tipo mesa ────────────────
  // cerrado_en también se setea al anular un pedido, por eso se exige que el
  // pedido tenga un total real en totalPorPedido (cobro_subpedidos vía cobro).
  const pedidosMesaCobrados = (pedidosData as any[]).filter(
    (p) => p.tipo === 'mesa' && p.estado === 'cerrado' && p.cerrado_en && totalPorPedido.has(p.id),
  )

  const tiempoServicio: TiempoServicioData =
    pedidosMesaCobrados.length > 0
      ? {
          promedioMinutos:
            pedidosMesaCobrados.reduce((s, p) => {
              const ms = new Date(p.cerrado_en).getTime() - new Date(p.created_at).getTime()
              return s + ms / 60000
            }, 0) / pedidosMesaCobrados.length,
          pedidosContados: pedidosMesaCobrados.length,
        }
      : { promedioMinutos: null, pedidosContados: 0 }

  // ── (6) Cancelaciones del turno: top motivos + monto perdido por mesero ───
  const motivoMap = new Map<string, { count: number; monto: number }>()
  const cancelPorMeseroMap = new Map<string, { count: number; monto: number }>()
  let montoTotalCancelado = 0

  for (const c of cancelacionesRaw ?? []) {
    montoTotalCancelado += c.monto_afectado

    const mEntry = motivoMap.get(c.motivo) ?? { count: 0, monto: 0 }
    motivoMap.set(c.motivo, { count: mEntry.count + 1, monto: mEntry.monto + c.monto_afectado })

    const key = c.usuario_id ?? ''
    const pEntry = cancelPorMeseroMap.get(key) ?? { count: 0, monto: 0 }
    cancelPorMeseroMap.set(key, { count: pEntry.count + 1, monto: pEntry.monto + c.monto_afectado })
  }

  const cancelaciones: CancelacionesData = {
    montoTotal: montoTotalCancelado,
    count: (cancelacionesRaw ?? []).length,
    porMotivo: [...motivoMap.entries()]
      .map(([motivo, v]) => ({ motivo, count: v.count, monto: v.monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5),
    porMesero: [...cancelPorMeseroMap.entries()]
      .map(([usuarioId, v]) => ({ nombre: nombreMesero(usuarioId || null), count: v.count, monto: v.monto }))
      .sort((a, b) => b.monto - a.monto),
  }

  // ── (7) Descuentos del turno: total, cortesía vs. otros, por mesero ───────
  const descuentosPorMeseroMap = new Map<string, { count: number; monto: number }>()
  let montoTotalDescuentos = 0
  let cortesiaCount = 0, cortesiaMonto = 0
  let otrosCount = 0, otrosMonto = 0

  for (const d of descuentosRes.data ?? []) {
    montoTotalDescuentos += (d as any).monto_calculado
    if ((d as any).tipo === 'corteria') {
      cortesiaCount++
      cortesiaMonto += (d as any).monto_calculado
    } else {
      otrosCount++
      otrosMonto += (d as any).monto_calculado
    }

    const key = (d as any).usuario_id ?? ''
    const entry = descuentosPorMeseroMap.get(key) ?? { count: 0, monto: 0 }
    descuentosPorMeseroMap.set(key, { count: entry.count + 1, monto: entry.monto + (d as any).monto_calculado })
  }

  const descuentos: DescuentosData = {
    montoTotal: montoTotalDescuentos,
    count: (descuentosRes.data ?? []).length,
    cortesia: { count: cortesiaCount, monto: cortesiaMonto },
    otros: { count: otrosCount, monto: otrosMonto },
    porMesero: [...descuentosPorMeseroMap.entries()]
      .map(([usuarioId, v]) => ({ nombre: nombreMesero(usuarioId || null), count: v.count, monto: v.monto }))
      .sort((a, b) => b.monto - a.monto),
  }

  // ── Datos para charts ─────────────────────────────────────────────────────
  const metodosPago: MetodoPagoData[] = [
    { nombre: '💵 Efectivo', monto: porMetodo.efectivo, color: '#10b981' },
    { nombre: '💳 Tarjeta', monto: porMetodo.tarjeta, color: '#3b82f6' },
    { nombre: '📱 Transf.', monto: porMetodo.transferencia, color: '#7c3aed' },
  ]

  const propinaPorMetodo: MetodoPagoData[] = [
    { nombre: '💵 Efectivo', monto: propinaAcumulada.efectivo, color: '#10b981' },
    { nombre: '💳 Tarjeta', monto: propinaAcumulada.tarjeta, color: '#3b82f6' },
    { nombre: '📱 Transf.', monto: propinaAcumulada.transferencia, color: '#7c3aed' },
  ]

  const tiposPedido: TipoPedidoData[] = [
    { nombre: 'Mesa', count: mesaCount, color: '#3b82f6' },
    { nombre: 'Para llevar', count: llevarCount, color: '#f59e0b' },
    { nombre: 'Mostrador', count: mostradorCount, color: '#8b5cf6' },
  ]

  // ── Rendimiento real vs. esperado por receta (producción por lotes) ───────
  const noventaDiasAtras = new Date(ahoraDate.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [{ data: recetasLoteRaw }, { data: produccionesRaw }] = await Promise.all([
    supabase.from('recetas').select('id, nombre, rendimiento_esperado').eq('modo_preparacion', 'por_lote'),
    supabase
      .from('producciones')
      .select('receta_id, fecha, cantidad_lote, cantidad_obtenida')
      .not('receta_id', 'is', null)
      .gte('fecha', noventaDiasAtras)
      .order('fecha', { ascending: true }),
  ])

  const produccionesPorReceta = new Map<number, RendimientoPunto[]>()
  for (const p of produccionesRaw ?? []) {
    if (!p.cantidad_lote || p.cantidad_lote <= 0) continue
    const arr = produccionesPorReceta.get(p.receta_id) ?? []
    arr.push({
      fecha: fmtFechaCorta(p.fecha),
      rendimientoReal: p.cantidad_obtenida / p.cantidad_lote,
    })
    produccionesPorReceta.set(p.receta_id, arr)
  }

  const rendimientoRecetas: RendimientoRecetaData[] = (recetasLoteRaw ?? []).map((r: any) => ({
    recetaId: r.id,
    recetaNombre: r.nombre,
    rendimientoEsperado: r.rendimiento_esperado,
    puntos: produccionesPorReceta.get(r.id) ?? [],
  }))
  const hayProduccion = rendimientoRecetas.some((r) => r.puntos.length > 0)

  const turnoLabel = `Turno #${turno.id} · desde ${fmtHora(turno.abierto_en)}`

  return (
    <div>
      <Header titulo="Dashboard" subtitulo={turnoLabel} ahora={ahora} />

      <div className="px-4 py-4 space-y-4">

        {pedidosAbiertos > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
            <span className="text-[18px]">⏳</span>
            <p className="text-xs font-medium text-amber-700">
              {pedidosAbiertos} pedido{pedidosAbiertos !== 1 ? 's' : ''} abierto
              {pedidosAbiertos !== 1 ? 's' : ''} en este momento
            </p>
          </div>
        )}

        {/* ── Métricas principales ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Total cobrado"
            value={`$${fmtMoney(totalCobrado)}`}
            color="green"
            big
          />
          <MetricCard
            label="Pedidos cerrados"
            value={String(pedidosCerrados)}
            unit={pedidosCerrados !== 1 ? 'pedidos' : 'pedido'}
            color="blue"
          />
          <MetricCard
            label="Promedio por pedido"
            value={pedidosCerrados > 0 ? `$${fmtMoney(promedioTicket)}` : '—'}
            color="amber"
          />
          <MetricCard
            label="Mesas activas"
            value={String(mesasActivas ?? 0)}
            unit={mesasActivas !== 1 ? 'mesas' : 'mesa'}
            color="violet"
          />
        </div>

        {/* ── (1) Comparativo vs. mismo día hace 7 días ────────────────────── */}
        <ComparativoSemanaCard actual={totalCobrado} anterior={totalCobradoAnterior} />

        {/* ── Gráficas Recharts ─────────────────────────────────────────────── */}
        {totalCobrado > 0 ||
        ticketPorTipo.mesa.count > 0 ||
        ticketPorTipo.llevar.count > 0 ||
        ticketPorTipo.mostrador.count > 0 ||
        ventasPorDiaSemana.some((v) => v.turnos > 0) ||
        tiempoServicio.pedidosContados > 0 ||
        cancelaciones.count > 0 ||
        descuentos.count > 0 ||
        turnosRecientes.length > 0 ||
        hayProduccion ? (
          <DashboardCharts
            ventasPorHora={ventasPorHora}
            topProductos={topProductos}
            metodosPago={metodosPago}
            tiposPedido={tiposPedido}
            ventasPorDiaSemana={ventasPorDiaSemana}
            ticketPorTipo={ticketPorTipo}
            tiempoServicio={tiempoServicio}
            cancelaciones={cancelaciones}
            descuentos={descuentos}
            propinaPorMetodo={propinaPorMetodo}
            turnosRecientes={turnosRecientes}
            rendimientoRecetas={rendimientoRecetas}
            ventasPorCategoria={ventasPorCategoria}
            ventasPorZona={ventasPorZona}
          />
        ) : (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-8 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm text-text-3">
              Las gráficas aparecerán cuando haya cobros en el turno.
            </p>
          </div>
        )}

        {/* ── (4) Temporada alta vs. normal ─────────────────────────────────── */}
        <TemporadaAltaCard {...temporadaAlta} />

        {/* ── Insumos bajo stock mínimo ──────────────────────────────────────── */}
        <InsumosBajoStockCard insumos={insumosBajoStock} />

        {/* ── Porciones bajas (producción por lotes) ─────────────────────────── */}
        <PorcionesBajasCard porciones={porcionesBajas} />

        {/* ── Margen por producto ────────────────────────────────────────────── */}
        <MargenProductosCard margenes={margenes} />

        <div className="h-2" />
      </div>
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Header({
  titulo,
  subtitulo,
  ahora,
}: {
  titulo: string
  subtitulo: string
  ahora: string
}) {
  return (
    <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[20px] font-bold leading-tight">{titulo}</h1>
          <p className="mt-0.5 text-[13px] text-text-3">{subtitulo}</p>
        </div>
        <p className="text-[11px] text-text-4 pt-1">↻ {ahora}</p>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  color,
  big = false,
}: {
  label: string
  value: string
  unit?: string
  color: 'green' | 'blue' | 'amber' | 'violet'
  big?: boolean
}) {
  const colorMap = {
    green:  { bg: 'bg-green-50',  text: 'text-green-600' },
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  }
  const c = colorMap[color]

  return (
    <div className={`rounded-2xl ${c.bg} px-4 py-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{label}</p>
      <p className={`mt-1.5 font-mono font-bold leading-tight ${c.text} ${big ? 'text-[22px]' : 'text-[20px]'}`}>
        {value}
      </p>
      {unit && <p className="mt-0.5 text-[11px] text-text-3">{unit}</p>}
    </div>
  )
}

function ComparativoSemanaCard({ actual, anterior }: { actual: number; anterior: number | null }) {
  return (
    <div className="rounded-2xl bg-s2 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
        Vs. mismo día hace 7 días
      </p>
      {anterior === null ? (
        <p className="mt-1 text-xs text-text-3">
          Sin turno cerrado ese día para comparar.
        </p>
      ) : anterior === 0 ? (
        <p className="mt-1 text-xs text-text-3">
          El turno de comparación no registró cobros.
        </p>
      ) : (
        (() => {
          const pct = ((actual - anterior) / anterior) * 100
          const subio = pct >= 0
          return (
            <div className="mt-1 flex items-baseline gap-2">
              <p className={`font-mono text-[18px] font-bold ${subio ? 'text-green-600' : 'text-red-600'}`}>
                {subio ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
              </p>
              <p className="text-[11px] text-text-3">
                ${fmtMoney(actual)} vs ${fmtMoney(anterior)}
              </p>
            </div>
          )
        })()
      )}
    </div>
  )
}

function TemporadaAltaCard({
  promedioAlta,
  promedioNormal,
  fechasAlta,
  fechasNormal,
}: {
  promedioAlta: number | null
  promedioNormal: number | null
  fechasAlta: number
  fechasNormal: number
}) {
  if (promedioAlta === null || promedioNormal === null) {
    return (
      <div className="rounded-2xl bg-s2 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Temporada alta vs. normal
        </p>
        <p className="mt-1 text-xs text-text-3">
          Sin datos suficientes para comparar. Agrega fechas de temporada alta o espera a que
          cierren turnos en esos días o en sus mismos días de semana.
        </p>
      </div>
    )
  }

  const diff = promedioNormal > 0 ? ((promedioAlta - promedioNormal) / promedioNormal) * 100 : null

  return (
    <div className="rounded-2xl bg-s2 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
        Temporada alta vs. normal
      </p>
      <p className="mt-1.5 text-[13px] text-text-2">
        Temporada alta:{' '}
        <span className="font-mono font-semibold text-green-600">${fmtMoney(promedioAlta)}</span>{' '}
        <span className="text-text-3">
          ({fechasAlta} turno{fechasAlta !== 1 ? 's' : ''})
        </span>
      </p>
      <p className="text-[13px] text-text-2">
        Día normal:{' '}
        <span className="font-mono font-semibold text-blue-600">${fmtMoney(promedioNormal)}</span>{' '}
        <span className="text-text-3">
          ({fechasNormal} turno{fechasNormal !== 1 ? 's' : ''})
        </span>
      </p>
      {diff !== null && (
        <p className={`mt-1 text-[13px] font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
        </p>
      )}
    </div>
  )
}

// ─── Insumos bajo stock mínimo ─────────────────────────────────────────────────

type InsumoBajoStock = {
  id: number
  nombre: string
  unidadMedida: string
  stockActual: number
  stockMinimo: number
}

function InsumosBajoStockCard({ insumos }: { insumos: InsumoBajoStock[] }) {
  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Insumos bajo stock mínimo
        </p>
        {insumos.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">
            {insumos.length}
          </span>
        )}
      </div>
      {insumos.length === 0 ? (
        <div className="px-4 py-4">
          <p className="text-[13px] text-text-3">Todo el inventario está por encima de su mínimo.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F2F2F7]">
          {insumos.map((i) => (
            <div key={i.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[13px] text-text-2">{i.nombre}</span>
              <span className="font-mono text-[12px] font-semibold text-red-600">
                {i.stockActual} / {i.stockMinimo} {i.unidadMedida}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Porciones bajas (producción por lotes) ───────────────────────────────────
// porciones_disponibles por debajo del consumo promedio diario de los
// últimos 14 días (consumo_diario_recetas_lote) — solo alerta si hay historial
// de consumo real (consumoPromedioDiario > 0), nunca sobre datos sin ventas.

type PorcionesBajas = {
  recetaId: number
  recetaNombre: string
  porcionesDisponibles: number
  consumoPromedioDiario: number
}

function PorcionesBajasCard({ porciones }: { porciones: PorcionesBajas[] }) {
  if (porciones.length === 0) return null

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Porciones bajas (producción por lote)
        </p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
          {porciones.length}
        </span>
      </div>
      <div className="divide-y divide-[#F2F2F7]">
        {porciones.map((p) => (
          <div key={p.recetaId} className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-2">{p.recetaNombre}</span>
              <span className="font-mono text-[12px] font-semibold text-amber-700">
                {p.porcionesDisponibles.toFixed(1)} porciones
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-text-3">
              Consumo promedio: {p.consumoPromedioDiario.toFixed(1)} porciones/día (últimos 14 días)
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Margen por producto ──────────────────────────────────────────────────────
// Costo de receta (o costo agregado de componentes si es combo), precio de
// venta, margen $ y margen %. Viene de la función SQL margen_productos() —
// costo_completo=FALSE cuando falta un dato (insumo sin compra, componente sin
// receta, etc.): en ese caso nunca se inventa un número, se muestra "incompleto".

type MargenProducto = {
  productoId: number
  nombre: string
  esCombo: boolean
  precio: number
  costo: number | null
  costoCompleto: boolean
  margen: number | null
  margenPct: number | null
  margenVariable: boolean
}

function MargenProductosCard({ margenes }: { margenes: MargenProducto[] }) {
  if (margenes.length === 0) return null

  // Peor margen primero (más accionable); los de costo incompleto al final.
  const ordenados = [...margenes].sort((a, b) => {
    if (a.costoCompleto !== b.costoCompleto) return a.costoCompleto ? -1 : 1
    if (a.margenPct === null || b.margenPct === null) return 0
    return a.margenPct - b.margenPct
  })

  const hayVariables = margenes.some((m) => m.margenVariable)

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Margen por producto
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#F2F2F7] text-left text-[10px] uppercase tracking-wide text-text-4">
              <th className="px-4 py-2 font-semibold">Producto</th>
              <th className="px-2 py-2 text-right font-semibold">Costo</th>
              <th className="px-2 py-2 text-right font-semibold">Precio</th>
              <th className="px-2 py-2 text-right font-semibold">Margen</th>
              <th className="px-4 py-2 text-right font-semibold">Margen %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F2F7]">
            {ordenados.map((m) => (
              <tr key={m.productoId}>
                <td className="whitespace-nowrap px-4 py-2">
                  <span className="font-medium text-text-2">{m.nombre}</span>
                  {m.esCombo && (
                    <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">
                      Combo
                    </span>
                  )}
                  {m.margenVariable && (
                    <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                      Varía
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-text-3">
                  {m.costoCompleto && m.costo !== null ? (
                    `${m.margenVariable ? '~' : ''}$${fmtMoney(m.costo)}`
                  ) : (
                    <span className="text-amber-600">incompleto</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-blue-600">
                  ${fmtMoney(m.precio)}
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-2 text-right font-mono font-semibold ${
                    m.margen === null ? 'text-text-4' : m.margen >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {m.margen === null ? '—' : `${m.margenVariable ? '~' : ''}$${fmtMoney(m.margen)}`}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2 text-right font-mono font-semibold ${
                    m.margenPct === null ? 'text-text-4' : m.margenPct >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {m.margenPct === null ? '—' : `${m.margenVariable ? '~' : ''}${m.margenPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hayVariables && (
        <p className="border-t border-[#F2F2F7] px-4 py-2.5 text-[11px] text-amber-600">
          ~ Varía según opción: el costo/margen mostrado es solo el piso con los insumos fijos —
          el real depende de la opción elegida (ej. tipo de carne, tamaño).
        </p>
      )}
    </div>
  )
}
