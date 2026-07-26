'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
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

interface DashboardChartsProps {
  ventasPorHora: VentaHora[]
  topProductos: TopProducto[]
  metodosPago: MetodoPagoData[]
  tiposPedido: TipoPedidoData[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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
}: DashboardChartsProps) {
  const [seleccionado, setSeleccionado] = useState<TopProducto | null>(null)
  const hayHoras = ventasPorHora.some((v) => v.total > 0)
  const hayProd = topProductos.length > 0
  const hayMetodos = metodosPago.some((m) => m.monto > 0)
  const hayTipos = tiposPedido.some((t) => t.count > 0)

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
              </div>
            </div>
          )}
        </div>
      )}

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
