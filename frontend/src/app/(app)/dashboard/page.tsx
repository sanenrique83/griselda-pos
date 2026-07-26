import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import type { VentaHora, TopProducto, MetodoPagoData, TipoPedidoData } from '@/components/dashboard/DashboardCharts'

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
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queries del turno activo
  // ─────────────────────────────────────────────────────────────────────────

  const [movimientosRes, pedidosCerradosRes, pedidosActivosRes, pedidoIdsRes] =
    await Promise.all([
      supabase
        .from('movimientos_caja')
        .select('id, tipo, monto, created_at')
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
      supabase.from('pedidos').select('id, tipo').eq('turno_id', turno.id),
    ])

  const movimientos = movimientosRes.data ?? []
  const pedidosCerrados = pedidosCerradosRes.count ?? 0
  const pedidosAbiertos = pedidosActivosRes.count ?? 0
  const pedidosData = pedidoIdsRes.data ?? []
  const pedidoIds = pedidosData.map((p: any) => p.id)

  // Pagos del turno
  const cobroIds = movimientos.filter((m) => m.tipo === 'cobro').map((m) => m.id)
  const { data: pagos } =
    cobroIds.length > 0
      ? await supabase
          .from('pagos')
          .select('metodo_pago, monto')
          .in('movimiento_id', cobroIds)
      : { data: [] as { metodo_pago: string; monto: number }[] }

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

  const promedioTicket = pedidosCerrados > 0 ? totalCobrado / pedidosCerrados : 0

  // ── Top 10 productos ──────────────────────────────────────────────────────
  let topProductos: TopProducto[] = []

  if (pedidoIds.length > 0) {
    const { data: subs } = await supabase
      .from('subpedidos')
      .select('id')
      .in('pedido_id', pedidoIds)

    const subIds = (subs ?? []).map((s: any) => s.id)

    if (subIds.length > 0) {
      const { data: config } = await supabase
        .from('config_sistema')
        .select('producto_libre_id')
        .eq('id', 1)
        .single()
      const productoLibreId = (config as any)?.producto_libre_id ?? null

      let query = supabase
        .from('pedido_productos')
        .select(
          'cantidad, precio_unit, productos(id, nombre, emoji), pedido_producto_opciones(precio_extra)',
        )
        .in('subpedido_id', subIds)
        .neq('estado', 'cancelado')

      // Los ítems "producto libre" son improvisados de una sola vez — no
      // aportan al ranking de productos del catálogo, se excluyen.
      if (productoLibreId) query = query.neq('producto_id', productoLibreId)

      const { data: rawProds } = await query

      const topMap = new Map<number, TopProducto>()
      for (const pp of rawProds ?? []) {
        const prod = (pp as any).productos
        if (!prod) continue
        const extras = ((pp as any).pedido_producto_opciones ?? []).reduce(
          (s: number, o: any) => s + o.precio_extra,
          0,
        )
        const lineTotal = ((pp as any).precio_unit + extras) * (pp as any).cantidad
        const entry = topMap.get(prod.id) ?? {
          nombre: prod.nombre,
          emoji: prod.emoji,
          vendidos: 0,
          total: 0,
        }
        topMap.set(prod.id, {
          ...entry,
          vendidos: entry.vendidos + (pp as any).cantidad,
          total: entry.total + lineTotal,
        })
      }

      topProductos = [...topMap.values()]
        .sort((a, b) => b.vendidos - a.vendidos)
        .slice(0, 10)
    }
  }

  // ── Ventas por franja horaria ─────────────────────────────────────────────
  const cobrosConHora = movimientos.filter((m) => m.tipo === 'cobro')
  const abiertaEn = new Date(turno.abierto_en)
  const ahoraDate = new Date()

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

  // ── Mesa vs para llevar ───────────────────────────────────────────────────
  const mesaCount = pedidosData.filter((p: any) => p.tipo === 'mesa').length
  const llevarCount = pedidosData.filter((p: any) => p.tipo === 'llevar').length

  // ── Datos para charts ─────────────────────────────────────────────────────
  const metodosPago: MetodoPagoData[] = [
    { nombre: '💵 Efectivo', monto: porMetodo.efectivo, color: '#10b981' },
    { nombre: '💳 Tarjeta', monto: porMetodo.tarjeta, color: '#3b82f6' },
    { nombre: '📱 Transf.', monto: porMetodo.transferencia, color: '#7c3aed' },
  ]

  const tiposPedido: TipoPedidoData[] = [
    { nombre: 'Mesa', count: mesaCount, color: '#3b82f6' },
    { nombre: 'Para llevar', count: llevarCount, color: '#f59e0b' },
  ]

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

        {/* ── Gráficas Recharts ─────────────────────────────────────────────── */}
        {totalCobrado > 0 ? (
          <DashboardCharts
            ventasPorHora={ventasPorHora}
            topProductos={topProductos}
            metodosPago={metodosPago}
            tiposPedido={tiposPedido}
          />
        ) : (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-8 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm text-text-3">
              Las gráficas aparecerán cuando haya cobros en el turno.
            </p>
          </div>
        )}

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
