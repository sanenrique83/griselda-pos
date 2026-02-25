'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { abrirTurno, cerrarTurno } from '@/app/(app)/mas/turno/actions'
import type { TurnoResumen } from '@/app/(app)/mas/turno/page'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TurnoShellProps {
  turnoActivo: TurnoResumen | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TurnoShell({ turnoActivo }: TurnoShellProps) {
  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <h1 className="text-[20px] font-bold leading-tight">Turno</h1>
        {turnoActivo ? (
          <p className="mt-0.5 text-[13px] text-text-3">
            #{turnoActivo.id} · {fmtFecha(turnoActivo.abierto_en)}
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] text-text-3">Sin turno activo</p>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {turnoActivo ? (
          <TurnoActivo turno={turnoActivo} />
        ) : (
          <AbrirTurnoForm />
        )}
      </div>
    </div>
  )
}

// ─── Subcomponente: Abrir turno ───────────────────────────────────────────────

function AbrirTurnoForm() {
  const [fondo, setFondo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAbrir() {
    setError(null)
    const fondoNum = parseFloat(fondo)
    if (isNaN(fondoNum) || fondoNum < 0) {
      setError('Ingresa un fondo inicial válido (puede ser $0.00).')
      return
    }
    startTransition(async () => {
      const result = await abrirTurno(fondoNum)
      if (result?.error) setError(result.error)
      // success: redirect from server action
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white shadow-card px-4 py-5 space-y-4">
        <div className="text-center py-2">
          <p className="text-[40px] mb-2">💰</p>
          <p className="text-[15px] font-semibold">Sin turno activo</p>
          <p className="mt-1 text-[13px] text-text-3">
            Abre el turno del día con el dinero inicial en caja.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
            Fondo inicial de caja
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[22px] font-bold text-text-3">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={fondo}
              onChange={(e) => setFondo(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-4 pl-10 pr-4 font-mono text-[22px] font-bold outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
          <p className="mt-1.5 text-xs text-text-3">
            Dinero físico en caja al inicio del turno (puede ser $0).
          </p>
        </div>

        {/* Chips rápidos */}
        <div className="flex flex-wrap gap-2">
          {[0, 200, 300, 500].map((v) => (
            <button
              key={v}
              onClick={() => setFondo(String(v))}
              className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
                parseFloat(fondo) === v
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-border bg-s2 text-text-2'
              }`}
            >
              ${v === 0 ? '0.00' : v}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={handleAbrir}
          disabled={isPending}
          className="w-full rounded-xl bg-blue-600 py-[18px] text-base font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
        >
          {isPending ? 'Abriendo turno…' : '▶ Abrir turno'}
        </button>
      </div>
    </div>
  )
}

// ─── Subcomponente: Turno activo + cierre ─────────────────────────────────────

function TurnoActivo({ turno }: { turno: TurnoResumen }) {
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const numContado = efectivoContado === '' ? 0 : parseFloat(efectivoContado)
  const diferencia =
    !isNaN(numContado) ? round2(numContado - turno.efectivoTeorico) : null

  function handleCerrar() {
    setError(null)
    if (isNaN(numContado) || numContado < 0) {
      setError('Ingresa el efectivo contado en caja.')
      return
    }
    startTransition(async () => {
      const result = await cerrarTurno({
        turnoId: turno.id,
        efectivoContado: numContado,
        notas: notas.trim() || null,
      })
      if (result?.error) setError(result.error)
    })
  }

  const metodoTotal =
    turno.porMetodo.efectivo + turno.porMetodo.tarjeta + turno.porMetodo.transferencia

  return (
    <div className="space-y-4">
      {/* Alerta de pedidos abiertos */}
      {turno.pedidosAbiertos > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
          <span className="text-[18px] mt-0.5">⚠️</span>
          <p className="text-xs font-medium text-amber-700">
            Hay {turno.pedidosAbiertos} pedido
            {turno.pedidosAbiertos !== 1 ? 's' : ''} abierto
            {turno.pedidosAbiertos !== 1 ? 's' : ''}. Ciérralos antes de cerrar el turno.
          </p>
        </div>
      )}

      {/* ── Resumen de ventas ──────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Ventas del turno
          </p>
        </div>
        <div className="divide-y divide-[#F2F2F7]">
          <ResumenRow
            label="Total cobrado"
            value={`$${fmtMoney(turno.totalCobrado)}`}
            bold
            green
          />
          {turno.porMetodo.efectivo > 0 && (
            <ResumenRow
              label="💵 Efectivo"
              value={`$${fmtMoney(turno.porMetodo.efectivo)}`}
              indent
            />
          )}
          {turno.porMetodo.tarjeta > 0 && (
            <ResumenRow
              label="💳 Tarjeta"
              value={`$${fmtMoney(turno.porMetodo.tarjeta)}`}
              indent
            />
          )}
          {turno.porMetodo.transferencia > 0 && (
            <ResumenRow
              label="📱 Transferencia"
              value={`$${fmtMoney(turno.porMetodo.transferencia)}`}
              indent
            />
          )}
          {metodoTotal === 0 && (
            <ResumenRow label="Sin cobros registrados" value="—" />
          )}
          <ResumenRow
            label="Pedidos cerrados"
            value={`${turno.pedidosCerrados}`}
          />
        </div>
      </div>

      {/* ── Conteo de efectivo ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Conteo de efectivo
          </p>
        </div>

        {/* Desglose teórico */}
        <div className="divide-y divide-[#F2F2F7]">
          <ResumenRow
            label="Fondo inicial"
            value={`$${fmtMoney(turno.fondoInicial)}`}
          />
          <ResumenRow
            label="+ Cobros en efectivo"
            value={`$${fmtMoney(turno.cobrosEfectivo)}`}
          />
          {turno.fondosExtra > 0 && (
            <ResumenRow
              label="+ Fondos / depósitos"
              value={`$${fmtMoney(turno.fondosExtra)}`}
            />
          )}
          {turno.retirosTotal > 0 && (
            <ResumenRow
              label="− Retiros"
              value={`−$${fmtMoney(turno.retirosTotal)}`}
            />
          )}
          <div className="flex items-center justify-between bg-s2 px-4 py-3.5">
            <p className="text-[14px] font-bold">Teórico en caja</p>
            <span className="font-mono text-[17px] font-bold text-blue-600">
              ${fmtMoney(turno.efectivoTeorico)}
            </span>
          </div>
        </div>

        {/* Input efectivo contado */}
        <div className="px-4 py-4 space-y-3 border-t border-[#E5E5EA]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-3">
            Efectivo contado en caja
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[22px] font-bold text-text-3">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={efectivoContado}
              onChange={(e) => setEfectivoContado(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-4 pl-10 pr-4 font-mono text-[22px] font-bold outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Diferencia en tiempo real */}
          {diferencia !== null && (
            <div
              className={`flex items-center justify-between rounded-xl px-4 py-3.5 ${
                Math.abs(diferencia) < 0.01
                  ? 'bg-emerald-50 border border-emerald-100'
                  : diferencia > 0
                    ? 'bg-blue-50 border border-blue-100'
                    : 'bg-red-50 border border-red-100'
              }`}
            >
              <div>
                <p
                  className={`text-sm font-bold ${
                    Math.abs(diferencia) < 0.01
                      ? 'text-emerald-700'
                      : diferencia > 0
                        ? 'text-blue-700'
                        : 'text-red-700'
                  }`}
                >
                  {Math.abs(diferencia) < 0.01
                    ? '✓ Cuadra perfectamente'
                    : diferencia > 0
                      ? 'Sobrante'
                      : 'Faltante'}
                </p>
                <p className="mt-0.5 text-xs text-text-3">
                  {Math.abs(diferencia) < 0.01
                    ? 'El efectivo coincide con lo esperado.'
                    : diferencia > 0
                      ? 'Hay más efectivo del esperado.'
                      : 'Hay menos efectivo del esperado.'}
                </p>
              </div>
              <span
                className={`font-mono text-[22px] font-bold ${
                  Math.abs(diferencia) < 0.01
                    ? 'text-emerald-600'
                    : diferencia > 0
                      ? 'text-blue-600'
                      : 'text-red-600'
                }`}
              >
                {diferencia > 0 ? '+' : ''}${fmtMoney(diferencia)}
              </span>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Notas del cierre (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: corte sin novedad, propinas repartidas…"
              rows={2}
              className="w-full resize-none rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3.5 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Botón de cierre */}
      <button
        onClick={handleCerrar}
        disabled={
          isPending ||
          turno.pedidosAbiertos > 0 ||
          isNaN(numContado)
        }
        className="w-full rounded-xl bg-red-600 py-[18px] text-base font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,.25)] active:scale-[.98] disabled:opacity-40"
      >
        {isPending ? 'Cerrando turno…' : '⏹ Cerrar turno'}
      </button>

      <p className="text-center text-[11px] text-text-4 pb-2">
        Esta acción no se puede deshacer. Registra el efectivo contado con cuidado.
      </p>
    </div>
  )
}

// ─── Utilidad de fila de resumen ──────────────────────────────────────────────

function ResumenRow({
  label,
  value,
  bold = false,
  green = false,
  indent = false,
}: {
  label: string
  value: string
  bold?: boolean
  green?: boolean
  indent?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${
        indent ? 'pl-8' : ''
      }`}
    >
      <p
        className={`text-sm ${bold ? 'font-bold' : 'text-text-2'} ${
          indent ? 'text-text-3 text-xs' : ''
        }`}
      >
        {label}
      </p>
      <span
        className={`font-mono text-sm font-semibold ${
          green ? 'text-green-600' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
