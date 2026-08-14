'use client'

import { useState } from 'react'
import { Star, Circle, ChevronRight, ArrowRight, Tag, MapPin } from 'lucide-react'
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
  ScatterChart,
  Scatter,
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

export interface HeatmapPunto {
  /** 0=domingo…6=sábado (EXTRACT(DOW) de Postgres) */
  diaSemana: number
  diaLabel: string
  hora: number
  promedio: number
  turnosContados: number
}

export interface MargenVolumenPunto {
  productoId: number
  nombre: string
  /** Unidades vendidas históricamente (no acotado al turno, igual que margen_productos()) */
  volumen: number
  margen: number
  margenPct: number
  margenVariable: boolean
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
  /** Día con mayor/menor promedio entre los que sí tienen turnos contados — null si no hay ninguno. */
  diaMayor: string | null
  diaMenor: string | null
  /** F8-01: una fila por combinación día×hora con datos — no incluye horas sin ningún cobro histórico. */
  heatmapHorasPico: HeatmapPunto[]
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
      <p className="text-sm font-bold text-[#173F2E]">${fmtMoney(payload[0].value)}</p>
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
          <p className="text-sm font-bold text-[#173F2E]">${fmtMoney(payload[0].value)}</p>
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
  diaMayor,
  diaMenor,
  heatmapHorasPico,
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
  const hayHeatmap = heatmapHorasPico.length > 0
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
                <Bar dataKey="total" fill="#173F2E" radius={[4, 4, 0, 0]} maxBarSize={32} />
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
                    <Cell key={i} fill={v.turnos > 0 ? '#173F2E' : '#E5E5EA'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(diaMayor || diaMenor) && (
            <div className="flex items-center gap-4 border-t border-[#F2F2F7] px-4 py-2.5 text-[11px] text-text-3">
              {diaMayor && (
                <span className="flex items-center gap-1">
                  <Star size={11} strokeWidth={2.2} className="text-[#173F2E]" fill="#173F2E" />
                  Mayor: {diaMayor}
                </span>
              )}
              {diaMenor && (
                <span className="flex items-center gap-1">
                  <Circle size={9} strokeWidth={2.2} className="text-red-500" fill="#ef4444" />
                  Menor: {diaMenor}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── (a.3) F8-01: Heatmap de horas pico ───────────────────────────────── */}
      {hayHeatmap && <HeatmapHorasPicoCard puntos={heatmapHorasPico} />}

      {/* ── (b) Top productos ────────────────────────────────────────────── */}
      {hayProd && (
        <TopProductosCard
          topProductos={topProductos}
          onVerDetalle={(p) => setSeleccionado(p)}
        />
      )}

      {/* ── (b.2) Ventas por categoría y por zona de preparación ────────────── */}
      {(hayCategorias || hayZonas) && (
        <div className="grid grid-cols-1 gap-3">
          {hayCategorias && (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              <SectionHeader title="Ventas por categoría" />
              <div className="px-4 py-3.5">
                <VentasPorCategoriaGrid items={ventasPorCategoria} />
              </div>
            </div>
          )}
          {hayZonas && (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              <SectionHeader title="Ventas por zona de preparación" />
              <div className="px-4 py-3.5">
                <VentasPorZonaLista items={ventasPorZona} />
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
                  <TicketPromedioRow label="Ticket mesa" data={ticketPorTipo.mesa} color="#173F2E" />
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
              <p className="font-mono text-[22px] font-bold text-[#173F2E]">
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
              const colorClase = sobrante ? 'text-[#173F2E]' : faltante ? 'text-red-600' : 'text-text-3'
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
                      <p className="font-mono text-sm font-bold text-[#173F2E]">×{v.vendidos}</p>
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

// ─── F8-01: Heatmap de horas pico ─────────────────────────────────────────────
// Cuadrícula día×hora — filas = horas de operación reales (rango continuo
// entre la hora más temprana y más tardía con algún cobro histórico, nunca
// 0-23), columnas = días de la semana. Intensidad de verde bosque según el
// promedio (nunca rojo — no es una alerta, es un patrón). Tocar una celda
// muestra el detalle abajo, ya que no hay tooltip nativo en un grid de divs
// (esto no es una gráfica de Recharts).

function HeatmapHorasPicoCard({ puntos }: { puntos: HeatmapPunto[] }) {
  const [celda, setCelda] = useState<HeatmapPunto | null>(null)

  const horas = [...new Set(puntos.map((p) => p.hora))].sort((a, b) => a - b)
  const horaMin = horas[0]
  const horaMax = horas[horas.length - 1]
  const rangoHoras = Array.from({ length: horaMax - horaMin + 1 }, (_, i) => horaMin + i)

  const porCelda = new Map<string, HeatmapPunto>()
  for (const p of puntos) porCelda.set(`${p.diaSemana}-${p.hora}`, p)

  const maxPromedio = Math.max(...puntos.map((p) => p.promedio))

  function colorCelda(p: HeatmapPunto | undefined): string {
    if (!p || maxPromedio <= 0) return '#F2F2F7'
    const intensidad = 0.12 + 0.88 * (p.promedio / maxPromedio)
    return `rgba(23, 63, 46, ${intensidad.toFixed(2)})`
  }

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <SectionHeader title="Horas pico (últimos 8 turnos por combinación)" />
      <div className="overflow-x-auto px-3 pt-3 pb-2">
        <div className="inline-grid min-w-full gap-[3px]" style={{ gridTemplateColumns: `32px repeat(7, 1fr)` }}>
          {/* Encabezado de días */}
          <div />
          {DIAS_SEMANA_LABEL_HEATMAP.map((label) => (
            <div key={label} className="pb-1 text-center text-[10px] font-semibold text-text-3">
              {label}
            </div>
          ))}

          {/* Una fila por hora */}
          {rangoHoras.map((hora) => (
            <FragmentoFilaHeatmap
              key={hora}
              hora={hora}
              porCelda={porCelda}
              colorCelda={colorCelda}
              celdaSeleccionada={celda}
              onSeleccionar={setCelda}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-[#F2F2F7] px-4 py-2.5 text-[12px]">
        {celda ? (
          celda.turnosContados > 0 ? (
            <p className="text-text-2">
              <span className="font-semibold">
                {celda.diaLabel} {String(celda.hora).padStart(2, '0')}:00
              </span>{' '}
              — ${fmtMoney(celda.promedio)} promedio, de {celda.turnosContados} turno
              {celda.turnosContados !== 1 ? 's' : ''}
            </p>
          ) : (
            <p className="text-text-3">Sin cobros históricos en ese horario.</p>
          )
        ) : (
          <p className="text-text-3">Toca una celda para ver el detalle.</p>
        )}
      </div>
    </div>
  )
}

// Índice = EXTRACT(DOW): 0=domingo…6=sábado — mismo orden que DIAS_SEMANA_LABEL
// en dashboard/page.tsx, pero declarado aparte porque ese vive en el server
// component y este archivo es 'use client'.
const DIAS_SEMANA_LABEL_HEATMAP = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function FragmentoFilaHeatmap({
  hora,
  porCelda,
  colorCelda,
  celdaSeleccionada,
  onSeleccionar,
}: {
  hora: number
  porCelda: Map<string, HeatmapPunto>
  colorCelda: (p: HeatmapPunto | undefined) => string
  celdaSeleccionada: HeatmapPunto | null
  onSeleccionar: (p: HeatmapPunto) => void
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-1 text-[10px] font-medium text-text-3">
        {String(hora).padStart(2, '0')}h
      </div>
      {DIAS_SEMANA_LABEL_HEATMAP.map((_, dow) => {
        const p = porCelda.get(`${dow}-${hora}`)
        const seleccionada = celdaSeleccionada?.diaSemana === dow && celdaSeleccionada?.hora === hora
        return (
          <button
            key={dow}
            onClick={() => p && onSeleccionar(p)}
            disabled={!p}
            className={`aspect-square rounded-[4px] transition-transform ${
              seleccionada ? 'ring-2 ring-[#173F2E] ring-offset-1' : ''
            }`}
            style={{ backgroundColor: colorCelda(p) }}
            aria-label={p ? `${DIAS_SEMANA_LABEL_HEATMAP[dow]} ${hora}:00 — $${fmtMoney(p.promedio)}` : undefined}
          />
        )
      })}
    </>
  )
}

// ─── F8-02: Dispersión margen vs. volumen ─────────────────────────────────────
// Exportado aparte (no forma parte de las props de <DashboardCharts>) porque
// vive junto a <MargenProductosCard> en dashboard/page.tsx — sección de
// costeo de catálogo, independiente del turno, con su propio punto de
// inserción en las dos ramas de esa página (con/sin turno activo).

function TooltipMargenVolumen({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p: MargenVolumenPunto = payload[0].payload
  return (
    <div className="rounded-xl bg-white border border-[#E5E5EA] shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-text-2">{p.nombre}</p>
      <p className="text-[11px] text-text-3">{p.volumen} vendidos</p>
      <p className="text-sm font-bold text-[#173F2E]">
        {p.margenVariable ? '~' : ''}${fmtMoney(p.margen)} ({p.margenPct.toFixed(1)}%)
      </p>
    </div>
  )
}

export function MargenVolumenScatterCard({ puntos }: { puntos: MargenVolumenPunto[] }) {
  if (puntos.length === 0) return null

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <SectionHeader title="Margen vs. volumen" />
      <div className="px-2 pt-3 pb-4">
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              type="number"
              dataKey="volumen"
              name="Volumen"
              tick={{ fontSize: 10, fill: '#8E8E93' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Unidades vendidas', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#8E8E93' }}
            />
            <YAxis
              type="number"
              dataKey="margen"
              name="Margen"
              tick={{ fontSize: 10, fill: '#8E8E93' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${fmtMoney(v)}`}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<TooltipMargenVolumen />} />
            <Scatter data={puntos} fill="#173F2E" fillOpacity={0.75} />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="mt-1 px-2 text-[10px] text-text-3">
          Cada punto es un producto — toca o pasa el cursor para ver su nombre.
        </p>
      </div>
    </div>
  )
}

// ─── Top productos — lista numerada con barra de progreso ────────────────────
// Antes era una gráfica de barras horizontal mostrando los 10 siempre; el
// mockup pide una lista de 5 + "Ver los 10 productos" — la data ya traía
// los 10 (query .slice(0, 10)), así que el expand es puro estado local
// sobre lo ya cargado, sin query nueva. Tocar una fila con variantes abre
// el mismo sheet de desglose que ya existía (antes se activaba tocando la
// barra); antes era un mecanismo real pero poco visible, ahora es un
// affordance explícito (chevron).

function TopProductosCard({
  topProductos,
  onVerDetalle,
}: {
  topProductos: TopProducto[]
  onVerDetalle: (p: TopProducto) => void
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const visibles = mostrarTodos ? topProductos : topProductos.slice(0, 5)
  const maxVendidos = topProductos[0]?.vendidos ?? 1

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Top {topProductos.length} productos
        </p>
      </div>
      <div className="divide-y divide-[#F2F2F7]">
        {visibles.map((p, i) => {
          const tieneDesglose = p.variantes.length > 0
          return (
            <button
              key={i}
              onClick={() => tieneDesglose && onVerDetalle(p)}
              disabled={!tieneDesglose}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-s2 disabled:active:bg-transparent"
            >
              <span className="w-4 flex-shrink-0 text-[13px] font-bold text-text-3">{i + 1}</span>
              <span className="flex-shrink-0 text-[16px]">{p.emoji ?? '🍽️'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-text">{p.nombre}</p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-s2">
                  <div
                    className="h-full rounded-full bg-[#173F2E]"
                    style={{ width: `${Math.max(4, (p.vendidos / maxVendidos) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="flex-shrink-0 font-mono text-[12px] text-text-3">×{p.vendidos}</span>
              <span className="w-[64px] flex-shrink-0 text-right font-mono text-[13px] font-bold text-[#173F2E]">
                ${fmtMoney(p.total)}
              </span>
              {tieneDesglose && (
                <ChevronRight size={14} strokeWidth={2.2} className="flex-shrink-0 text-text-4" />
              )}
            </button>
          )
        })}
      </div>
      {topProductos.length > 5 && (
        <button
          onClick={() => setMostrarTodos((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-[#F2F2F7] py-3 text-[13px] font-semibold text-[#173F2E] active:bg-s2"
        >
          {mostrarTodos ? 'Ver menos' : `Ver los ${topProductos.length} productos`}
          <ArrowRight size={14} strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}

// ─── Ventas por categoría — tarjetas con % + barra ────────────────────────────
// El mockup muestra un ícono propio por categoría, pero `categorias` no tiene
// columna de ícono/emoji en la base real — se usa un ícono genérico (Tag) en
// vez de inventar uno por categoría. Los tintes son puramente decorativos
// para diferenciar tarjetas vecinas (mismo criterio que TINTES_MESA en
// Historial/Cobro) — nunca azul/esmeralda/verde suelto.
const TINTES_CATEGORIA = [
  { bg: 'bg-teal-50', text: 'text-teal-700', bar: 'bg-teal-500' },
  { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-indigo-500' },
  { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500' },
  { bg: 'bg-pink-50', text: 'text-pink-700', bar: 'bg-pink-500' },
]

function VentasPorCategoriaGrid({ items }: { items: PersonaMonto[] }) {
  const total = items.reduce((s, i) => s + i.monto, 0)
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((item, i) => {
        const tinte = TINTES_CATEGORIA[i % TINTES_CATEGORIA.length]
        const pct = total > 0 ? Math.round((item.monto / total) * 100) : 0
        return (
          <div key={i} className={`rounded-xl ${tinte.bg} p-3`}>
            <div className="flex items-center gap-1.5">
              <Tag size={12} strokeWidth={2.2} className={tinte.text} />
              <p className={`truncate text-[10px] font-semibold uppercase tracking-wide ${tinte.text}`}>
                {item.nombre}
              </p>
            </div>
            <p className="mt-1.5 font-mono text-[13px] font-bold text-text">${fmtMoney(item.monto)}</p>
            <p className={`text-[18px] font-bold ${tinte.text}`}>{pct}%</p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/60">
              <div className={`h-full rounded-full ${tinte.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Ventas por zona de preparación — lista simple ────────────────────────────
// El mockup muestra un "N min promedio" por zona que no existe: no hay
// timestamp de "completado"/"listo" por zona en el modelo actual (solo
// pendiente/enviado/cancelado) — no se inventa. `count` es la suma de
// cantidad de producto, no de pedidos — se etiqueta "productos", no
// "pedidos", para no decir algo que el dato no es.
function VentasPorZonaLista({ items }: { items: PersonaMonto[] }) {
  return (
    <div className="divide-y divide-[#F2F2F7]">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-s2 text-text-2">
            <MapPin size={15} strokeWidth={2.2} />
          </span>
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{item.nombre}</p>
          <p className="flex-shrink-0 text-[12px] text-text-3">{item.count} producto{item.count !== 1 ? 's' : ''}</p>
          <p className="flex-shrink-0 font-mono text-[13px] font-bold text-[#173F2E]">${fmtMoney(item.monto)}</p>
        </div>
      ))}
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
