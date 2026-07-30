'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BotonRegresarMas } from '@/components/layout/BotonRegresarMas'
import type { CorteZReporte } from '@/app/(app)/mas/corte-z/page'
import { imprimirTicket, type TicketConfig } from '@/lib/print'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

function fmtFechaLarga(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportarCSV(reporte: CorteZReporte) {
  const rows: string[] = [
    `Corte Z,${reporte.fecha}`,
    '',
    `Ventas totales,${reporte.ventasTotales.toFixed(2)}`,
    `Efectivo,${reporte.porMetodo.efectivo.toFixed(2)}`,
    `Tarjeta,${reporte.porMetodo.tarjeta.toFixed(2)}`,
    `Transferencia,${reporte.porMetodo.transferencia.toFixed(2)}`,
    `Mixto,${reporte.porMetodo.mixto.toFixed(2)}`,
    `Descuentos,${reporte.descuentosTotal.toFixed(2)}`,
    `Cancelaciones,${reporte.cancelacionesTotal.toFixed(2)}`,
    `Propina efectivo,${reporte.propinaEfectivo.toFixed(2)}`,
    `Propina tarjeta,${reporte.propinaTarjeta.toFixed(2)}`,
    `Ticket promedio,${reporte.ticketPromedio.toFixed(2)}`,
    `Mesas atendidas,${reporte.mesasAtendidas}`,
    `Pedidos cerrados,${reporte.pedidosCerrados}`,
    '',
    'Turno,Apertura,Cierre,Cajero,Ventas',
    ...reporte.turnos.map((t) =>
      [
        t.id,
        fmtFechaHora(t.aperturaIso),
        t.cierreIso ? fmtFechaHora(t.cierreIso) : 'En curso',
        `"${t.cajeroNombre}"`,
        t.ventas.toFixed(2),
      ].join(','),
    ),
  ]
  const csv = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `corte-z-${reporte.fecha}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CorteZShell({
  reporte,
  ticketConfig,
  impresionActiva,
}: {
  reporte: CorteZReporte
  ticketConfig: TicketConfig
  impresionActiva: boolean
}) {
  const router = useRouter()
  const [fechaInput, setFechaInput] = useState(reporte.fecha)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [printError, setPrintError] = useState(false)

  useEffect(() => {
    if (!printError) return
    const t = setTimeout(() => setPrintError(false), 4000)
    return () => clearTimeout(t)
  }, [printError])

  function handleGenerar() {
    router.push(`/mas/corte-z?fecha=${fechaInput}`)
  }

  async function handleImprimir() {
    setImprimiendo(true)
    setPrintError(false)
    try {
      const ok = await imprimirTicket(
        {
          tipo: 'corte_z',
          fecha: reporte.fecha,
          config: ticketConfig,
          ventasTotales: reporte.ventasTotales,
          porMetodo: reporte.porMetodo,
          descuentosTotal: reporte.descuentosTotal,
          cancelacionesTotal: reporte.cancelacionesTotal,
          propinaEfectivo: reporte.propinaEfectivo,
          propinaTarjeta: reporte.propinaTarjeta,
          ticketPromedio: reporte.ticketPromedio,
          mesasAtendidas: reporte.mesasAtendidas,
          pedidosCerrados: reporte.pedidosCerrados,
          turnos: reporte.turnos.map((t) => ({
            id: t.id,
            apertura: fmtFechaHora(t.aperturaIso),
            cierre: t.cierreIso ? fmtFechaHora(t.cierreIso) : null,
            cajero: t.cajeroNombre,
            ventas: t.ventas,
          })),
        },
        impresionActiva,
      )
      if (!ok) setPrintError(true)
    } catch {
      setPrintError(true)
    } finally {
      setImprimiendo(false)
    }
  }

  const hayDatos = reporte.turnos.length > 0

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <BotonRegresarMas />
        <h1 className="mt-1 text-[20px] font-bold leading-tight">Corte Z</h1>
        <p className="mt-0.5 text-[13px] text-text-3 capitalize">{fmtFechaLarga(reporte.fecha)}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ── Selector de fecha ─────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card px-4 py-3.5 flex items-center gap-2">
          <input
            type="date"
            value={fechaInput}
            onChange={(e) => setFechaInput(e.target.value)}
            className="flex-1 rounded-xl border border-[#E5E5EA] px-3 py-2.5 text-[14px] font-medium text-text-1"
          />
          <button
            onClick={handleGenerar}
            className="flex-shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white active:opacity-70"
          >
            Generar Corte Z
          </button>
        </div>

        {!hayDatos && (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-4">
            <p className="text-sm font-semibold text-amber-800">Sin turnos ese día</p>
            <p className="mt-1 text-xs text-amber-600">
              No se abrió ningún turno con esa fecha de apertura.
            </p>
          </div>
        )}

        {/* ── Métricas principales ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Ventas totales" value={`$${fmtMoney(reporte.ventasTotales)}`} color="green" big />
          <MetricCard
            label="Ticket promedio"
            value={reporte.pedidosCerrados > 0 ? `$${fmtMoney(reporte.ticketPromedio)}` : '—'}
            color="amber"
          />
          <MetricCard
            label="Mesas atendidas"
            value={String(reporte.mesasAtendidas)}
            unit={reporte.mesasAtendidas !== 1 ? 'mesas' : 'mesa'}
            color="violet"
          />
          <MetricCard
            label="Pedidos cerrados"
            value={String(reporte.pedidosCerrados)}
            unit={reporte.pedidosCerrados !== 1 ? 'pedidos' : 'pedido'}
            color="blue"
          />
        </div>

        {/* ── Método de pago ───────────────────────────────────────────────── */}
        <Section title="Método de pago">
          <FilaMonto label="💵 Efectivo" monto={reporte.porMetodo.efectivo} />
          <FilaMonto label="💳 Tarjeta" monto={reporte.porMetodo.tarjeta} />
          <FilaMonto label="📱 Transferencia" monto={reporte.porMetodo.transferencia} />
          <FilaMonto label="🔀 Mixto" monto={reporte.porMetodo.mixto} />
        </Section>

        {/* ── Propinas ──────────────────────────────────────────────────────── */}
        <Section title="Propinas">
          <FilaMonto label="Efectivo" monto={reporte.propinaEfectivo} />
          <FilaMonto label="Tarjeta" monto={reporte.propinaTarjeta} />
        </Section>

        {/* ── Descuentos y cancelaciones ──────────────────────────────────── */}
        <Section title="Descuentos y cancelaciones">
          <FilaMonto label="Descuentos" monto={reporte.descuentosTotal} negativo />
          <FilaMonto label="Cancelaciones" monto={reporte.cancelacionesTotal} negativo />
        </Section>

        {/* ── Turnos del día ────────────────────────────────────────────────── */}
        {hayDatos && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Turnos del día ({reporte.turnos.length})
              </p>
            </div>
            <div className="divide-y divide-[#F2F2F7]">
              {reporte.turnos.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold">Turno #{t.id}</p>
                    <span className="font-mono text-[14px] font-bold text-green-600">
                      ${fmtMoney(t.ventas)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-3">
                    {fmtFechaHora(t.aperturaIso)} → {t.cierreIso ? fmtFechaHora(t.cierreIso) : 'en curso'}
                  </p>
                  <p className="text-[12px] text-text-3">Cajero: {t.cajeroNombre}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Acciones ──────────────────────────────────────────────────────── */}
        {printError && (
          <p className="text-center text-xs font-semibold text-red-600">
            No se pudo conectar con la impresora.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => exportarCSV(reporte)}
            disabled={!hayDatos}
            className="flex-1 rounded-xl bg-white border border-[#E5E5EA] py-3.5 text-[14px] font-semibold text-text-2 active:opacity-70 disabled:opacity-40"
          >
            ↓ Exportar CSV
          </button>
          <button
            onClick={handleImprimir}
            disabled={!hayDatos || imprimiendo}
            className="flex-1 rounded-xl bg-blue-600 py-3.5 text-[14px] font-semibold text-white active:opacity-70 disabled:opacity-40"
          >
            {imprimiendo ? 'Enviando…' : '🖨 Imprimir'}
          </button>
        </div>

        <div className="h-2" />
      </div>
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

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
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{title}</p>
      </div>
      <div className="divide-y divide-[#F2F2F7]">{children}</div>
    </div>
  )
}

function FilaMonto({
  label,
  monto,
  negativo = false,
}: {
  label: string
  monto: number
  negativo?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-[13px] text-text-2">{label}</p>
      <span
        className={`font-mono text-[13px] font-semibold ${negativo && monto > 0 ? 'text-red-600' : 'text-text-1'}`}
      >
        {negativo && monto > 0 ? '-' : ''}${fmtMoney(monto)}
      </span>
    </div>
  )
}
