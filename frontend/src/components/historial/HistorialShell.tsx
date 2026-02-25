'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReciboData, PagoResumen, TurnoItem } from '@/app/(app)/historial/page'

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

function fmtFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Mexico_City',
  })
}

const METODO_LABEL: Record<PagoResumen['metodo'], string> = {
  efectivo: '💵 Efectivo',
  tarjeta: '💳 Tarjeta',
  transferencia: '📱 Transferencia',
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportarCSV(recibos: ReciboData[], turnoId: number | null) {
  const header = 'ID,Hora,Mesa,Total,Efectivo recibido,Cambio,Métodos'
  const rows = recibos.map((r) => {
    const metodos = r.pagos.map((p) => `${p.metodo}:$${p.monto.toFixed(2)}`).join(' | ')
    return [
      r.id,
      new Date(r.createdAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
      `"${r.mesaLabel}"`,
      r.total.toFixed(2),
      r.efectivoRecibido !== null ? r.efectivoRecibido.toFixed(2) : '',
      r.cambio !== null ? r.cambio.toFixed(2) : '',
      `"${metodos}"`,
    ].join(',')
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `historial-turno-${turnoId ?? 'sin-turno'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function HistorialShell({
  recibos,
  sinTurno,
  turnos,
  turnoSeleccionadoId,
  isAdmin,
}: {
  recibos: ReciboData[]
  sinTurno: boolean
  turnos: TurnoItem[]
  turnoSeleccionadoId: number | null
  isAdmin: boolean
}) {
  const router = useRouter()
  const [seleccionado, setSeleccionado] = useState<ReciboData | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)

  const turnoActual = turnos.find((t) => t.id === turnoSeleccionadoId)
  const turnoLabel = turnoActual
    ? `Turno #${turnoActual.id} · ${fmtFechaCorta(turnoActual.abierto_en)} ${fmtHora(turnoActual.abierto_en)}`
    : 'Turno activo'

  function handleSeleccionarTurno(id: number) {
    setSelectorOpen(false)
    router.push(`/historial?turno=${id}`)
  }

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-tight">Historial</h1>
            {isAdmin && turnos.length > 0 ? (
              <button
                onClick={() => setSelectorOpen(true)}
                className="mt-0.5 flex items-center gap-1 text-[13px] text-blue-600 font-medium active:opacity-60"
              >
                {turnoLabel}
                <span className="text-[11px]">▾</span>
              </button>
            ) : (
              <p className="mt-0.5 text-[13px] text-text-3">Cobros del turno activo</p>
            )}
          </div>
          {recibos.length > 0 && (
            <button
              onClick={() => exportarCSV(recibos, turnoSeleccionadoId)}
              className="flex-shrink-0 rounded-xl bg-s2 px-3 py-2 text-[12px] font-semibold text-text-2 active:bg-s3"
            >
              ↓ CSV
            </button>
          )}
        </div>
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

      {/* Bottom sheet: detalle de recibo */}
      {seleccionado && (
        <ReciboSheet recibo={seleccionado} onClose={() => setSeleccionado(null)} />
      )}

      {/* Bottom sheet: selector de turno */}
      {selectorOpen && (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/40"
            onClick={() => setSelectorOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[60] max-h-[70vh] flex flex-col rounded-t-2xl bg-white">
            <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
              <div className="h-[5px] w-10 rounded-full bg-[#C7C7CC]" />
            </div>
            <div className="flex-shrink-0 px-5 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[16px] font-bold">Seleccionar turno</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#F2F2F7]">
              {turnos.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSeleccionarTurno(t.id)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 text-left active:bg-s2 ${
                    t.id === turnoSeleccionadoId ? 'bg-blue-50' : ''
                  }`}
                >
                  <div>
                    <p className="text-[14px] font-semibold">Turno #{t.id}</p>
                    <p className="text-[12px] text-text-3">
                      {fmtFechaCorta(t.abierto_en)} · {fmtHora(t.abierto_en)}
                      {t.cerrado_en ? ` → ${fmtHora(t.cerrado_en)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.estado === 'abierto' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Activo
                      </span>
                    )}
                    {t.id === turnoSeleccionadoId && (
                      <span className="text-blue-600 text-[16px]">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 px-5 py-4 border-t border-[#E5E5EA]">
              <button
                onClick={() => setSelectorOpen(false)}
                className="w-full rounded-xl bg-s2 py-3.5 text-[15px] font-semibold text-text-2 active:bg-s3"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
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
      <div className="fixed inset-0 z-[55] bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-white pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-[5px] w-10 rounded-full bg-[#C7C7CC]" />
        </div>
        <div className="px-5 pb-6 space-y-4">
          <div>
            <p className="text-[18px] font-bold">{r.mesaLabel}</p>
            <p className="text-[13px] text-text-3">
              Recibo #{r.id} · {fmtHora(r.createdAt)}
            </p>
          </div>

          <div className="rounded-xl bg-s2 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Total cobrado</p>
            <span className="font-mono text-[20px] font-bold text-green-600">
              ${fmtMoney(r.total)}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-[#E5E5EA] divide-y divide-[#F2F2F7] overflow-hidden">
            {r.pagos.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm">{METODO_LABEL[p.metodo]}</p>
                <span className="font-mono text-sm font-semibold">${fmtMoney(p.monto)}</span>
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
                  <span className="font-mono text-xs text-text-3">${fmtMoney(r.cambio)}</span>
                </div>
              </>
            )}
          </div>

          <button
            disabled
            className="w-full rounded-xl border-2 border-dashed border-[#C7C7CC] py-4 text-sm font-semibold text-text-3 disabled:opacity-60"
          >
            🖨 Enviar a impresora — próximamente
          </button>

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
      <p className="text-[15px] font-semibold text-text-2">Sin cobros en este turno</p>
      <p className="mt-1 text-sm text-text-3">
        Los cobros aparecerán aquí cuando se registren.
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
