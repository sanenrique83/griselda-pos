'use client'

import { useState } from 'react'
import type { ReciboData, PagoResumen } from '@/app/(app)/historial/page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

const METODO_LABEL: Record<PagoResumen['metodo'], string> = {
  efectivo: '💵 Efectivo',
  tarjeta: '💳 Tarjeta',
  transferencia: '📱 Transferencia',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function HistorialShell({
  recibos,
  sinTurno,
}: {
  recibos: ReciboData[]
  sinTurno: boolean
}) {
  const [seleccionado, setSeleccionado] = useState<ReciboData | null>(null)

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <h1 className="text-[20px] font-bold leading-tight">Historial</h1>
        <p className="mt-0.5 text-[13px] text-text-3">Cobros del turno activo</p>
      </div>

      <div className="px-4 py-4">
        {sinTurno ? (
          <SinTurnoState />
        ) : recibos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            {recibos.map((r, idx) => (
              <ReciboRow
                key={r.id}
                recibo={r}
                isLast={idx === recibos.length - 1}
                onVer={() => setSeleccionado(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet de detalle / reimprimir */}
      {seleccionado && (
        <ReciboSheet recibo={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  )
}

// ─── Fila de recibo ───────────────────────────────────────────────────────────

function ReciboRow({
  recibo: r,
  isLast,
  onVer,
}: {
  recibo: ReciboData
  isLast: boolean
  onVer: () => void
}) {
  return (
    <button
      onClick={onVer}
      className={`w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-s2 ${
        isLast ? '' : 'border-b border-[#F2F2F7]'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-tight">{r.mesaLabel}</p>
        <p className="mt-0.5 text-[12px] text-text-3">
          #{r.id} · {fmtHora(r.createdAt)}
          {r.pagos.length > 1 && ' · Mixto'}
          {r.pagos.length === 1 && ` · ${METODO_LABEL[r.pagos[0].metodo]}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[15px] font-bold text-green-600">
          ${fmtMoney(r.total)}
        </span>
        <span className="text-[18px] text-text-4">›</span>
      </div>
    </button>
  )
}

// ─── Bottom sheet de detalle ──────────────────────────────────────────────────

function ReciboSheet({
  recibo: r,
  onClose,
}: {
  recibo: ReciboData
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55] bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-white pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-[5px] w-10 rounded-full bg-[#C7C7CC]" />
        </div>

        {/* Contenido */}
        <div className="px-5 pb-6 space-y-4">
          {/* Título */}
          <div>
            <p className="text-[18px] font-bold">{r.mesaLabel}</p>
            <p className="text-[13px] text-text-3">
              Recibo #{r.id} · {fmtHora(r.createdAt)}
            </p>
          </div>

          {/* Total */}
          <div className="rounded-xl bg-s2 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Total cobrado</p>
            <span className="font-mono text-[20px] font-bold text-green-600">
              ${fmtMoney(r.total)}
            </span>
          </div>

          {/* Desglose de pagos */}
          <div className="rounded-xl bg-white border border-[#E5E5EA] divide-y divide-[#F2F2F7] overflow-hidden">
            {r.pagos.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm">{METODO_LABEL[p.metodo]}</p>
                <span className="font-mono text-sm font-semibold">
                  ${fmtMoney(p.monto)}
                </span>
              </div>
            ))}
            {r.efectivoRecibido !== null && r.cambio !== null && r.cambio > 0 && (
              <>
                <div className="flex items-center justify-between px-4 py-3 bg-s2">
                  <p className="text-xs text-text-3">Recibido en efectivo</p>
                  <span className="font-mono text-xs text-text-3">
                    ${fmtMoney(r.efectivoRecibido)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-s2">
                  <p className="text-xs text-text-3">Cambio entregado</p>
                  <span className="font-mono text-xs text-text-3">
                    ${fmtMoney(r.cambio)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Botón reimprimir (stub) */}
          <button
            disabled
            className="w-full rounded-xl border-2 border-dashed border-[#C7C7CC] py-4 text-sm font-semibold text-text-3 disabled:opacity-60"
          >
            🖨 Enviar a impresora — próximamente
          </button>

          {/* Cerrar */}
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-s2 py-4 text-sm font-semibold text-text-2 active:opacity-70"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Estados vacíos ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[48px] mb-3">🧾</p>
      <p className="text-[15px] font-semibold text-text-2">Sin cobros aún</p>
      <p className="mt-1 text-sm text-text-3">
        Los cobros del turno activo aparecerán aquí.
      </p>
    </div>
  )
}

function SinTurnoState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[48px] mb-3">🔒</p>
      <p className="text-[15px] font-semibold text-text-2">Sin turno activo</p>
      <p className="mt-1 text-sm text-text-3">
        Abre un turno desde la sección Más para registrar cobros.
      </p>
    </div>
  )
}
