import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'

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

  // ── Mesas activas (siempre, sin importar turno) ────────────────────────────
  const { count: mesasActivas } = await supabase
    .from('mesas')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'ocupada')

  // ─────────────────────────────────────────────────────────────────────────
  // Si no hay turno: renderizar estado vacío
  // ─────────────────────────────────────────────────────────────────────────
  if (!turno) {
    return (
      <div>
        <Header titulo="Dashboard" subtitulo="Sin turno activo" ahora={ahora} />
        <div className="px-4 py-4 space-y-4">
          <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-4">
            <p className="text-sm font-semibold text-amber-800">
              No hay turno abierto
            </p>
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
  // Queries del turno activo (en paralelo donde sea posible)
  // ─────────────────────────────────────────────────────────────────────────

  const [movimientosRes, pedidosCerradosRes, pedidosActivosRes, pedidoIdsRes] =
    await Promise.all([
      supabase
        .from('movimientos_caja')
        .select('id, tipo, monto')
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
      supabase.from('pedidos').select('id').eq('turno_id', turno.id),
    ])

  const movimientos = movimientosRes.data ?? []
  const pedidosCerrados = pedidosCerradosRes.count ?? 0
  const pedidosAbiertos = pedidosActivosRes.count ?? 0
  const pedidoIds = (pedidoIdsRes.data ?? []).map((p: any) => p.id)

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

  const promedioTicket =
    pedidosCerrados > 0 ? totalCobrado / pedidosCerrados : 0

  // ── Top productos ─────────────────────────────────────────────────────────
  type TopProd = {
    nombre: string
    emoji: string | null
    vendidos: number
    total: number
  }

  let topProductos: TopProd[] = []

  if (pedidoIds.length > 0) {
    const { data: subs } = await supabase
      .from('subpedidos')
      .select('id')
      .in('pedido_id', pedidoIds)

    const subIds = (subs ?? []).map((s: any) => s.id)

    if (subIds.length > 0) {
      const { data: rawProds } = await supabase
        .from('pedido_productos')
        .select(
          'cantidad, precio_unit, productos(id, nombre, emoji), pedido_producto_opciones(precio_extra)',
        )
        .in('subpedido_id', subIds)
        .neq('estado', 'cancelado')

      const topMap = new Map<number, TopProd>()
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
        .slice(0, 6)
    }
  }

  // ── Label del turno ───────────────────────────────────────────────────────
  const turnoLabel = `Turno #${turno.id} · desde ${fmtHora(turno.abierto_en)}`
  const metodoTotal = porMetodo.efectivo + porMetodo.tarjeta + porMetodo.transferencia

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

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

        {/* ── Métricas principales ────────────────────────────────────────── */}
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

        {/* ── Métodos de pago ─────────────────────────────────────────────── */}
        {totalCobrado > 0 && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <SectionHeader title="Métodos de pago" />
            <div className="px-4 py-3 space-y-3">
              <PaymentBar
                emoji="💵"
                label="Efectivo"
                amount={porMetodo.efectivo}
                total={metodoTotal}
                color="emerald"
              />
              <PaymentBar
                emoji="💳"
                label="Tarjeta"
                amount={porMetodo.tarjeta}
                total={metodoTotal}
                color="blue"
              />
              <PaymentBar
                emoji="📱"
                label="Transf."
                amount={porMetodo.transferencia}
                total={metodoTotal}
                color="violet"
              />
            </div>
          </div>
        )}

        {/* ── Top productos ────────────────────────────────────────────────── */}
        {topProductos.length > 0 && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <SectionHeader title="Más vendidos del turno" />
            <div className="divide-y divide-[#F2F2F7]">
              {topProductos.map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[22px] w-8 text-center leading-none">
                    {p.emoji ?? '🍽️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-text-3">
                      ×{p.vendidos} vendido{p.vendidos !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-green-600">
                    ${fmtMoney(p.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalCobrado === 0 && (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-8 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm text-text-3">
              Las métricas aparecerán cuando haya cobros en el turno.
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

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
        {title}
      </p>
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
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  dot: 'bg-green-400' },
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-400' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-400' },
  }
  const c = colorMap[color]

  return (
    <div className={`rounded-2xl ${c.bg} px-4 py-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
        {label}
      </p>
      <p
        className={`mt-1.5 font-mono font-bold leading-tight ${c.text} ${
          big ? 'text-[22px]' : 'text-[20px]'
        }`}
      >
        {value}
      </p>
      {unit && (
        <p className="mt-0.5 text-[11px] text-text-3">{unit}</p>
      )}
    </div>
  )
}

function PaymentBar({
  emoji,
  label,
  amount,
  total,
  color,
}: {
  emoji: string
  label: string
  amount: number
  total: number
  color: 'emerald' | 'blue' | 'violet'
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0
  const barColorMap = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
  }

  if (amount === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[16px] leading-none">{emoji}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">
            ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </span>
          <span className="w-8 text-right text-xs text-text-3">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-s3">
        <div
          className={`h-full rounded-full ${barColorMap[color]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
