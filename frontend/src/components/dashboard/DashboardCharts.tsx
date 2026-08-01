'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface VentaHora {
  hora: string
  total: number
}

export interface TopProducto {
  nombre: string
  emoji: string | null
  vendidos: number
  total: number
  /** Desglose por variante/modificador (ej. "Res" vs "Pollo"). Vacio si no aplica. */
  variantes: { nombre: string; vendidos: number; total: number }[]
}

export interface MetodoPagoData {
  nombre: string
  monto: number
  color: string
}

export interface TipoPedidoData {
  nombre: string
  count: number
  color: string
}

export interface VentaPorDiaSemana {
  dia: string
  promedio: number
  /** Cuántos turnos cerrados entraron en el promedio (0-8) */
  turnos: number
}

export interface TicketTipoStat {
  promedio: number
  /** Pedidos cerrados de este tipo que entraron en el cálculo */
  count: number
}

export interface TicketPorTipoData {
  mesa: TicketTipoStat
  llevar: TicketTipoStat
  mostrador: TicketTipoStat
}

export interface TiempoServicioData {
  /** Minutos promedio entre apertura y cobro total, pedidos tipo mesa */
  promedioMinutos: number | null
  pedidosContados: number
}

export interface CancelacionMotivo {
  motivo: string
  count: number
  monto: number
}

export interface PersonaMonto {
  nombre: string
  count: number
  monto: number
}

export interface CancelacionesData {
  montoTotal: number
  count: number
  /** Top motivos, ordenados por monto perdido descendente */
  porMotivo: CancelacionMotivo[]
  porMesero: PersonaMonto[]
}

export interface DescuentosData {
  montoTotal: number
  count: number
  cortesia: { count: number; monto: number }
  otros: { count: number; monto: number }
  porMesero: PersonaMonto[]
}

export interface TurnoRecienteData {
  id: number
  /** Fecha/hora de cierre, ya formateada (America/Mexico_City) */
  fechaCierre: string
  diferencia: number | null
  /** "Sin registrar" para turnos cerrados antes de trackear cerrado_por */
  cerradoPor: string
}

export interface RendimientoPunto {
  /** Fecha ya formateada, ej. "26 jul" */
  fecha: string
  rendimientoReal: number
}

export interface RendimientoRecetaData {
  recetaId: number
  recetaNombre: string
  rendimientoEsperado: number | null
  /** Una producción registrada por punto, en orden cronológico */
  puntos: RendimientoPunto[]
}

interface DashboardChartsProps {
  ventasPorHora: VentaHora[]
  topProductos: TopProducto[]
  metodosPago: MetodoPagoData[]
  tiposPedido: TipoPedidoData[]
  ventasPorDiaSemana: VentaPorDiaSemana[]
  ticketPorTipo: TicketPorTipoData
  tiempoServicio: TiempoServicioData
  cancelaciones: CancelacionesData
  descuentos: DescuentosData
  propinaPorMetodo: MetodoPagoData[]
  turnosRecientes: TurnoRecienteData[]
  rendimientoRecetas: RendimientoRecetaData[]
  /** Ventas del turno agrupadas por categorías.nombre (F9-05) */
  ventasPorCategoria: PersonaMonto[]
  /** Ventas del turno agrupadas por categorias.grupo_impresora_id → nombre (F9-05) */
  ventasPorZona: PersonaMonto[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDuracion(minutos: number) {
  const totalMin = Math.round(minutos)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{title}</p>
    </div>
  )
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────

function TooltipMoney({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white border border-[#E5E5EA] shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-text-2">{label}</p>
      <p className="text-sm font-bold text-green-600">${fmtMoney(payload[0].value)}</p>
    </div>
  )
}

function TooltipProductos({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white border border-[#E5E5EA] shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-text-2 truncate max-w-[160px]">{label}</p>
      <p className="text-sm font-bold text-blue-600">×{payload[0].value} vendidos</p>
    </div>
  )
}

function TooltipDiaSemana({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const turnos = payload[0].payload?.turnos ?? 0
  return (
    <div className="rounded-xl bg-white border border-[#E5E5EA] shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-text-2">{label}</p>
      {turnos > 0 ? (
        <>
          <p className="text-sm font-bold text-indigo-600">${fmtMoney(payload[0].value)}</p>
          <p className="text-[10px] text-text-3">promedio de {turnos} turno{turnos !== 1 ? 's' : ''}</p>
        </>
      ) : (
        <p className="text-[11px] text-text-3">sin turnos cerrados</p>
      )}
    </div>
  )
}

function TooltipRendimiento({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white border border-[#E5E5EA] shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-text-2">{label}</p>
      <p className="text-sm font-bold text-amber-600">{payload[0].value.toFixed(2)} porciones/unidad</p>
    </div>
  )
}

// ─── Label personalizado para Donut ──────────────────────────────────────────

function renderDonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function DashboardCharts({
  ventasPorHora,
  topProductos,
  metodosPago,
  tiposPedido,
  ventasPorDiaSemana,
  ticketPorTipo,
  tiempoServicio,
  cancelaciones,
  descuentos,
  propinaPorMetodo,
  turnosRecientes,
  rendimientoRecetas,
  ventasPorCategoria,
  ventasPorZona,
}: DashboardChartsProps) {
  const [seleccionado, setSeleccionado] = useState<TopProducto | null>(null)
  const hayHoras = ventasPorHora.some((v) => v.total > 0)
  const hayProd = topProductos.length > 0
  const hayCategorias = ventasPorCategoria.length > 0
  const hayZonas = ventasPorZona.length > 0
  const hayMetodos = metodosPago.some((m) => m.monto > 0)
  const hayTipos = tiposPedido.some((t) => t.count > 0)
  const hayDiaSemana = ventasPorDiaSemana.some((v) => v.turnos > 0)
  const hayTiempoServicio = tiempoServicio.pedidosContados > 0
  const hayCancelaciones = cancelaciones.count > 0
  const hayDescuentos = descuentos.count > 0
  const hayPropina = propinaPorMetodo.some((p) => p.monto > 0)
  const hayTurnosRecientes = turnosRecientes.length > 0
  const recetasConProduccion = rendimientoRecetas.filter((r) => r.puntos.length > 0)
  const hayRendimiento = recetasConProduccion.length > 0

  return (
    <div className="space-y-4">
      {/* ── (a) Ventas por hora ────────────────────────────────────────────── */}
      {hayHoras && (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <SectionHeader title="Ventas por hora" />
          <div className="px-2 pt-3 pb-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={ventasPorHora} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="hora"
                  tick={{ fontSize: 10, fill: '#8E8E93' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8E8E93' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${fmtMoney(v)}`}
                />
                <Tooltip content={<TooltipMoney />} />
                <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── (a.2) Ventas promedio por día de semana ──────────────────────────── */}
      {hayDiaSemana && (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <SectionHeader title="Ventas promedio por día (últimos 8 turnos)" />
          <div className="px-2 pt-3 pb-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={ventasPorDiaSemana} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 10, fill: '#8E8E93' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8E8E93' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${fmtMoney(v)}`}
                />
                <Tooltip content={<TooltipDiaSemana />} />
                <Bar dataKey="promedio" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {ventasPorDiaSemana.map((v, i) => (
                    <Cell key={i} fill={v.turnos > 0 ? '#6366f1' : '#E5E5EA'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── (b) Top 10 productos ───────────────────────────────────────────── */}
      {hayProd && (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <SectionHeader title="Top 10 productos" />
          <div className="px-2 pt-3 pb-1">
            <ResponsiveContainer width="100%" height={Math.max(topProductos.length * 28 + 16, 80)}>
              <BarChart
                data={topProductos.map((p, idx) => ({
                  idx,
                  nombre: `${p.emoji ?? '🍽️'} ${p.nombre}`,
                  vendidos: p.vendidos,
                  tieneDesglose: p.variantes.length > 0,
                }))}
                layout="vertical"
                margin={{ top: 0, right: 48, left: 4, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={130}
                  tick={{ fontSize: 11, fill: '#3C3C43' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TooltipProductos />} />
                <Bar
                  dataKey="vendidos"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  label={{ position: 'right', fontSize: 11, fill: '#3C3C43', formatter: (v: number) => `×${v}` }}
                  onClick={(data: any) => {
                    const p = topProductos[data.idx]
                    if (p && p.variantes.length > 0) setSeleccionado(p)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {topProductos.map((p, i) => (
                    <Cell key={i} fill={p.variantes.length > 0 ? '#3b82f6' : '#93c5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {topProductos.some((p) => p.variantes.length > 0) && (
            <p className="px-4 pb-3 text-[10px] text-text-3">
              💡 Toca una barra en azul fuerte para ver el desglose por variante
            </p>
          )}
        </div>
      )}

      {/* ── (b.2) Ventas por categoría y por zona de preparación ────────────── */}
      {(hayCategorias || hayZonas) && (
        <div className="grid grid-cols-1 gap-3">
          {hayCategorias && (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              <SectionHeader title="Ventas por categoría" />
              <div className="px-4 py-3.5">
                <ListaPersonaMonto items={ventasPorCategoria} color="#3b82f6" />
              </div>
            </div>
          )}
          {hayZonas && (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              <SectionHeader title="Ventas por zona de preparación" />
              <div className="px-4 py-3.5">
                <ListaPersonaMonto items={ventasPorZona} color="#10b981" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── (c) + (d) Donuts ─────────────────────────────────────────────── */}
      {(hayMetodos || hayTipos) && (
        <div className="grid grid-cols-2 gap-3">
          {/* Métodos de pago */}
          {hayMetodos && (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              <div className="border-b border-[#E5E5EA] px-3 pt-3 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-3">
                  Métodos
                </p>
              </div>
              <div className="flex flex-col items-center py-3">
                <PieChart width={120} height={100}>
                  <Pie
                    data={metodosPago.filter((m) => m.monto > 0)}
                    dataKey="monto"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={46}
                    labelLine={false}
                    label={renderDonutLabel}
                  >
                    {metodosPago.filter((m) => m.monto > 0).map((m, i) => (
                      <Cell key={i} fill={m.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="mt-1 space-y-0.5 w-full px-3">
                  {metodosPago.filter((m) => m.monto > 0).map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-[10px] text-text-3 truncate">{m.nombre}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mesa vs para llevar */}
          {hayTipos && (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              <div className="border-b border-[#E5E5EA] px-3 pt-3 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-3">
                  Tipo pedido
                </p>
              </div>
              <div className="flex flex-col items-center py-3">
                <PieChart width={120} height={100}>
                  <Pie
                    data={tiposPedido.filter((t) => t.count > 0)}
                    dataKey="count"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={46}
                    labelLine={false}
                    label={renderDonutLabel}
                  >
                    {tiposPedido.filter((t) => t.count > 0).map((t, i) => (
                      <Cell key={i} fill={t.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="mt-1 space-y-0.5 w-full px-3">
                  {tiposPedido.filter((t) => t.count > 0).map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-[10px] text-text-3 truncate">{t.nombre} ({t.count})</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 w-full border-t border-[#F2F2F7] px-3 pt-2 space-y-1">
                  <TicketPromedioRow label="Ticket mesa" data={ticketPorTipo.mesa} color="#3b82f6" />
                  <TicketPromedioRow label="Ticket llevar" data={ticketPorTipo.llevar} color="#f59e0b" />
                  <TicketPromedioRow label="Ticket mostrador" data={ticketPorTipo.mostrador} color="#8b5cf6" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── (d.2) Propina: efectivo vs. tarjeta ──────────────────────────────── */}
      {hayPropina && (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <SectionHeader title="Propina del turno" />
          <div className="px-4 py-3.5">
            <div className="grid grid-cols-2 gap-3">
              {propinaPorMetodo.filter((p) => p.monto > 0).map((p, i) => (
                <MiniStatHex key={i} label={p.nombre} value={`$${fmtMoney(p.monto)}`} color={p.color} />
              ))}
            </div>
            <p className="mt-2.5 text-[10px] text-text-3">
              En cobros mixtos, la propina se reparte proporcional al monto pagado por cada método.
            </p>
          </div>
        </div>
      )}

      {/* ── (e) Tiempo apertura → cobro (mesa) ─────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <SectionHeader title="Tiempo apertura → cobro (mesa)" />
        <div className="px-4 py-4">
          {hayTiempoServicio ? (
            <>
              <p className="font-mono text-[22px] font-bold text-blue-600">
                {fmtDuracion(tiempoServicio.promedioMinutos!)}
              </p>
              <p className="mt-0.5 text-[11px] text-text-3">
                promedio de {tiempoServicio.pedidosContados} pedido
                {tiempoServicio.pedidosContados !== 1 ? 's' : ''} tipo mesa cobrados en este turno
              </p>
            </>
          ) : (
            <p className="text-xs text-text-3">
              Sin pedidos tipo mesa cobrados por completo en este turno todavía.
            </p>
          )}
        </div>
      </div>

      {/* ── (f) Cancelaciones del turno ──────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <SectionHeader title="Cancelaciones del turno" />
        {hayCancelaciones ? (
          <div className="px-4 py-3.5">
            <div className="grid grid-cols-2 gap-3 mb-3.5">
              <MiniStat label="Monto perdido" value={`$${fmtMoney(cancelaciones.montoTotal)}`} color="red" />
              <MiniStat label="Items cancelados" value={String(cancelaciones.count)} color="amber" />
            </div>
            {cancelaciones.porMotivo.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3 mb-1.5">
                  Top motivos
                </p>
                <ListaPersonaMonto items={cancelaciones.porMotivo.map((m) => ({ nombre: m.motivo, count: m.count, monto: m.monto }))} color="#ef4444" className="mb-3.5" />
              </>
            )}
            {cancelaciones.porMesero.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3 mb-1.5">
                  Por mesero
                </p>
                <ListaPersonaMonto items={cancelaciones.porMesero} color="#ef4444" />
              </>
            )}
          </div>
        ) : (
          <div className="px-4 py-4">
            <p className="text-xs text-text-3">Sin cancelaciones en este turno.</p>
          </div>
        )}
      </div>

      {/* ── (g) Descuentos del turno ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <SectionHeader title="Descuentos del turno" />
        {hayDescuentos ? (
          <div className="px-4 py-3.5">
            <div className="grid grid-cols-2 gap-3 mb-3.5">
              <MiniStat label="Total descontado" value={`$${fmtMoney(descuentos.montoTotal)}`} color="amber" />
              <MiniStat label="Descuentos aplicados" value={String(descuentos.count)} color="violet" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3 mb-1.5">
              Cortesía vs. otros
            </p>
            <div className="rounded-xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] overflow-hidden mb-3.5">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-text-2">Cortesía</span>
                <span className="font-mono text-xs font-semibold text-amber-600">
                  ×{descuentos.cortesia.count} · ${fmtMoney(descuentos.cortesia.monto)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-text-2">Otros (% / monto fijo)</span>
                <span className="font-mono text-xs font-semibold text-amber-600">
                  ×{descuentos.otros.count} · ${fmtMoney(descuentos.otros.monto)}
                </span>
              </div>
            </div>
            {descuentos.porMesero.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3 mb-1.5">
                  Por mesero
                </p>
                <ListaPersonaMonto items={descuentos.porMesero} color="#f59e0b" />
              </>
            )}
          </div>
        ) : (
          <div className="px-4 py-4">
            <p className="text-xs text-text-3">Sin descuentos aplicados en este turno.</p>
          </div>
        )}
      </div>

      {/* ── (h) Últimos 10 turnos cerrados ───────────────────────────────── */}
      {hayTurnosRecientes && (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <SectionHeader title="Últimos 10 turnos cerrados" />
          <div className="divide-y divide-[#F2F2F7]">
            {turnosRecientes.map((t) => {
              const sinConteo = t.diferencia === null
              const sobrante = !sinConteo && (t.diferencia as number) > 0
              const faltante = !sinConteo && (t.diferencia as number) < 0
              const colorClase = sobrante ? 'text-green-600' : faltante ? 'text-red-600' : 'text-text-3'
              const etiqueta = sinConteo
                ? 'Sin conteo'
                : sobrante
                  ? 'Sobrante'
                  : faltante
                    ? 'Faltante'
                    : 'Exacto'
              return (
                <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold truncate">Turno #{t.id}</p>
                    <p className="text-[12px] text-text-3 truncate">
                      {t.fechaCierre} · Cerró: {t.cerradoPor}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className={`font-mono text-[15px] font-bold ${colorClase}`}>
                      {sinConteo
                        ? '—'
                        : `${sobrante ? '+' : faltante ? '-' : ''}$${fmtMoney(Math.abs(t.diferencia as number))}`}
                    </p>
                    <p className={`text-[11px] ${colorClase}`}>{etiqueta}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── (i) Rendimiento real vs. esperado por receta (producción por lote) ── */}
      {hayRendimiento &&
        recetasConProduccion.map((r) => (
          <div key={r.recetaId} className="rounded-2xl bg-white shadow-card overflow-hidden">
            <SectionHeader title={`Rendimiento — ${r.recetaNombre}`} />
            <div className="px-2 pt-3 pb-4">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={r.puntos} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontSize: 10, fill: '#8E8E93' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#8E8E93' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<TooltipRendimiento />} />
                  {r.rendimientoEsperado !== null && (
                    <ReferenceLine
                      y={r.rendimientoEsperado}
                      stroke="#8E8E93"
                      strokeDasharray="4 4"
                      label={{ value: 'Esperado', position: 'insideTopRight', fontSize: 10, fill: '#8E8E93' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="rendimientoReal"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#f59e0b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}

      {/* ── Bottom sheet: desglose por variante ────────────────────────────── */}
      {seleccionado && (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/40"
            onClick={() => setSeleccionado(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-white pb-safe">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-[5px] w-10 rounded-full bg-[#C7C7CC]" />
            </div>
            <div className="px-5 pb-6 space-y-3">
              <div>
                <p className="text-[16px] font-bold">
                  {seleccionado.emoji ?? '🍽️'} {seleccionado.nombre}
                </p>
                <p className="text-[13px] text-text-3">
                  {seleccionado.vendidos} vendidos en total · ${fmtMoney(seleccionado.total)}
                </p>
              </div>
              <div className="rounded-xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] overflow-hidden">
                {seleccionado.variantes.map((v, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{v.nombre}</p>
                      <p className="text-[11px] text-text-3">
                        {Math.round((v.vendidos / seleccionado.vendidos) * 100)}% del producto
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-mono text-sm font-bold text-blue-600">×{v.vendidos}</p>
                      <p className="text-[11px] text-text-3">${fmtMoney(v.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setSeleccionado(null)}
                className="w-full rounded-xl bg-s2 py-3.5 text-sm font-semibold text-text-2 active:opacity-70"
              >
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Ticket promedio por tipo (mesa / llevar) ─────────────────────────────────

function TicketPromedioRow({
  label,
  data,
  color,
}: {
  label: string
  data: TicketTipoStat
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-text-3">{label}</span>
      {data.count > 0 ? (
        <span className="font-mono text-[10px] font-semibold" style={{ color }}>
          ${fmtMoney(data.promedio)}
        </span>
      ) : (
        <span className="text-[10px] text-text-4">—</span>
      )}
    </div>
  )
}

// ─── Mini stat tile (estilo MetricCard, tamaño reducido para secciones) ───────

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'red' | 'amber' | 'violet'
}) {
  const colorMap = {
    red:    { bg: 'bg-red-50',    text: 'text-red-600' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  }
  const c = colorMap[color]

  return (
    <div className={`rounded-xl ${c.bg} px-3 py-2.5`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-3">{label}</p>
      <p className={`mt-1 font-mono text-[16px] font-bold ${c.text}`}>{value}</p>
    </div>
  )
}

// Variante de MiniStat para colores arbitrarios (hex), como los de metodosPago
function MiniStatHex({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-s2 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-3">{label}</p>
      <p className="mt-1 font-mono text-[16px] font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

// ─── Lista motivo/mesero + monto (cancelaciones y descuentos) ────────────────

function ListaPersonaMonto({
  items,
  color,
  className = '',
}: {
  items: PersonaMonto[]
  color: string
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] overflow-hidden ${className}`}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-text-2 truncate pr-2">{item.nombre}</span>
          <span className="font-mono text-xs font-semibold flex-shrink-0" style={{ color }}>
            ×{item.count} · ${fmtMoney(item.monto)}
          </span>
        </div>
      ))}
    </div>
  )
}
