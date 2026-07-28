'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  CancelacionRow,
  CancelacionesFiltros,
  FiltroOpcion,
} from '@/app/(app)/mas/cancelaciones/page'

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

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportarCSV(filas: CancelacionRow[], filtros: CancelacionesFiltros) {
  const rows = [
    'Fecha,Mesa,Mesero,Producto,Modificadores,Motivo,Monto',
    ...filas.map((f) =>
      [
        fmtFechaHora(f.createdAt),
        `"${f.mesaLabel}"`,
        `"${f.meseroNombre}"`,
        `"${f.productoNombre}"`,
        `"${f.modificadores.join(' + ')}"`,
        `"${f.motivo.replace(/"/g, '""')}"`,
        f.monto.toFixed(2),
      ].join(','),
    ),
  ]
  const csv = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cancelaciones-${filtros.desde}_a_${filtros.hasta}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CancelacionesShell({
  filas,
  filtros,
  meserosOpciones,
  productosOpciones,
}: {
  filas: CancelacionRow[]
  filtros: CancelacionesFiltros
  meserosOpciones: FiltroOpcion[]
  productosOpciones: FiltroOpcion[]
}) {
  const router = useRouter()
  const [desde, setDesde] = useState(filtros.desde)
  const [hasta, setHasta] = useState(filtros.hasta)
  const [meseroId, setMeseroId] = useState(filtros.meseroId ?? '')
  const [motivo, setMotivo] = useState(filtros.motivo ?? '')
  const [productoId, setProductoId] = useState(filtros.productoId ?? '')

  function handleFiltrar() {
    const params = new URLSearchParams()
    params.set('desde', desde)
    params.set('hasta', hasta)
    if (meseroId) params.set('mesero', meseroId)
    if (motivo) params.set('motivo', motivo)
    if (productoId) params.set('producto', productoId)
    router.push(`/mas/cancelaciones?${params.toString()}`)
  }

  const totalMonto = filas.reduce((s, f) => s + f.monto, 0)

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <h1 className="text-[20px] font-bold leading-tight">Cancelaciones</h1>
        <p className="mt-0.5 text-[13px] text-text-3">
          {filtros.desde} → {filtros.hasta}
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ── Filtros ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Desde
              </span>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E5EA] px-3 py-2.5 text-[14px] font-medium text-text-1"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Hasta
              </span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E5EA] px-3 py-2.5 text-[14px] font-medium text-text-1"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Mesero
            </span>
            <select
              value={meseroId}
              onChange={(e) => setMeseroId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E5E5EA] px-3 py-2.5 text-[14px] font-medium text-text-1"
            >
              <option value="">Todos</option>
              {meserosOpciones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Producto
            </span>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E5E5EA] px-3 py-2.5 text-[14px] font-medium text-text-1"
            >
              <option value="">Todos</option>
              {productosOpciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Motivo
            </span>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Buscar en el motivo…"
              className="mt-1 w-full rounded-xl border border-[#E5E5EA] px-3 py-2.5 text-[14px] font-medium text-text-1"
            />
          </label>

          <button
            onClick={handleFiltrar}
            className="w-full rounded-xl bg-blue-600 py-3 text-[14px] font-semibold text-white active:opacity-70"
          >
            Filtrar
          </button>
        </div>

        {/* ── Tabla ─────────────────────────────────────────────────────────── */}
        {filas.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-card px-4 py-8 text-center">
            <p className="text-2xl mb-2">🗑️</p>
            <p className="text-sm text-text-3">Sin cancelaciones en este rango.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#F2F2F7] text-left text-[10px] uppercase tracking-wide text-text-4">
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Fecha</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Mesa</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Mesero</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Producto</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Motivo</th>
                    <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F2F7]">
                  {filas.map((f) => (
                    <tr key={f.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-text-3">
                        {fmtFechaHora(f.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-text-2">{f.mesaLabel}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-text-2">{f.meseroNombre}</td>
                      <td className="px-2 py-2.5 text-text-2">
                        <p className="font-medium">{f.productoNombre}</p>
                        {f.modificadores.length > 0 && (
                          <p className="text-[11px] text-text-3">{f.modificadores.join(' + ')}</p>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-text-3">{f.motivo}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold text-red-600">
                        ${fmtMoney(f.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Footer: totales ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-t border-[#E5E5EA] bg-s2 px-4 py-3">
              <p className="text-[12px] font-semibold text-text-2">
                {filas.length} cancelación{filas.length !== 1 ? 'es' : ''}
              </p>
              <span className="font-mono text-[15px] font-bold text-red-600">
                ${fmtMoney(totalMonto)}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => exportarCSV(filas, filtros)}
          disabled={filas.length === 0}
          className="w-full rounded-xl bg-white border border-[#E5E5EA] py-3.5 text-[14px] font-semibold text-text-2 active:opacity-70 disabled:opacity-40"
        >
          ↓ Exportar CSV
        </button>

        <div className="h-2" />
      </div>
    </div>
  )
}
