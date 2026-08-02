'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BotonRegresarMas } from '@/components/layout/BotonRegresarMas'
import { abrirTurno, cerrarTurno, registrarMovimiento } from '@/app/(app)/mas/turno/actions'
import type { TurnoResumen, MovimientoCajaItem } from '@/app/(app)/mas/turno/page'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TurnoShellProps {
  turnoActivo: TurnoResumen | null
  diferenciaAlertaMonto: number
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

export function TurnoShell({ turnoActivo, diferenciaAlertaMonto }: TurnoShellProps) {
  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <BotonRegresarMas />
        <h1 className="mt-1 text-[20px] font-bold leading-tight">Turno</h1>
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
          <TurnoActivo turno={turnoActivo} diferenciaAlertaMonto={diferenciaAlertaMonto} />
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

function TurnoActivo({
  turno,
  diferenciaAlertaMonto,
}: {
  turno: TurnoResumen
  diferenciaAlertaMonto: number
}) {
  const router = useRouter()
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Advertencia no bloqueante: si la diferencia supera el umbral configurado,
  // pide una segunda confirmación explícita antes de cerrar de verdad.
  const [confirmandoCierre, setConfirmandoCierre] = useState(false)

  // Movimientos de caja
  const [sheetMovimiento, setSheetMovimiento] = useState<'fondo' | 'retiro' | null>(null)
  const [montoMov, setMontoMov] = useState('')
  const [notasMov, setNotasMov] = useState('')
  const [errorMov, setErrorMov] = useState<string | null>(null)
  const [isPendingMov, startMov] = useTransition()

  function handleRegistrarMovimiento() {
    const monto = parseFloat(montoMov)
    if (!sheetMovimiento || isNaN(monto) || monto <= 0) {
      setErrorMov('Ingresa un monto válido.')
      return
    }
    setErrorMov(null)
    startMov(async () => {
      const result = await registrarMovimiento({
        turnoId: turno.id,
        tipo: sheetMovimiento,
        monto,
        notas: notasMov.trim() || null,
      })
      if (result?.error) {
        setErrorMov(result.error)
      } else {
        setSheetMovimiento(null)
        setMontoMov('')
        setNotasMov('')
        router.refresh()
      }
    })
  }

  const numContado = efectivoContado === '' ? 0 : parseFloat(efectivoContado)
  const diferencia =
    !isNaN(numContado) ? round2(numContado - turno.efectivoTeorico) : null
  const diferenciaExcedeUmbral = diferencia !== null && Math.abs(diferencia) > diferenciaAlertaMonto

  function handleCerrar() {
    setError(null)
    if (isNaN(numContado) || numContado < 0) {
      setError('Ingresa el efectivo contado en caja.')
      return
    }
    // No bloqueante: la primera vez que se dispara con la diferencia por
    // encima del umbral, solo muestra la advertencia y pide un segundo tap
    // explícito — no cierra todavía.
    if (diferenciaExcedeUmbral && !confirmandoCierre) {
      setConfirmandoCierre(true)
      return
    }
    startTransition(async () => {
      const result = await cerrarTurno({
        turnoId: turno.id,
        efectivoContado: numContado,
        notas: notas.trim() || null,
      })
      if (result?.error) {
        setError(result.error)
        setConfirmandoCierre(false)
      }
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
          {turno.propinaTotal > 0 && (
            <ResumenRow
              label="Propinas a meseros"
              value={`$${fmtMoney(turno.propinaTotal)}`}
              indent
            />
          )}
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
          {turno.propinaEfectivo > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-2">Propina en efectivo</p>
                <span className="font-mono text-sm font-semibold text-amber-600">
                  ${fmtMoney(turno.propinaEfectivo)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                Retirar antes de cerrar turno
              </p>
            </div>
          )}
          {turno.propinaTarjeta > 0 && (
            <ResumenRow
              label="Propina en tarjeta"
              value={`$${fmtMoney(turno.propinaTarjeta)}`}
            />
          )}
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

      {/* ── Movimientos de caja ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Movimientos de caja
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3">
          <button
            onClick={() => { setSheetMovimiento('fondo'); setMontoMov(''); setNotasMov(''); setErrorMov(null) }}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 py-3.5 text-[14px] font-semibold text-blue-700 active:scale-[.97]"
          >
            💰 Depositar
          </button>
          <button
            onClick={() => { setSheetMovimiento('retiro'); setMontoMov(''); setNotasMov(''); setErrorMov(null) }}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 py-3.5 text-[14px] font-semibold text-amber-700 active:scale-[.97]"
          >
            🏦 Retirar
          </button>
        </div>

        {turno.movimientos.length > 0 && (
          <div className="divide-y divide-[#F2F2F7] border-t border-[#E5E5EA]">
            {turno.movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium">
                    {m.tipo === 'fondo' ? '💰 Depósito' : '🏦 Retiro'}
                    {m.notas ? ` · ${m.notas}` : ''}
                  </p>
                  <p className="text-[11px] text-text-3">
                    {new Date(m.created_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                      timeZone: 'America/Mexico_City',
                    })}
                  </p>
                </div>
                <span
                  className={`font-mono text-[14px] font-semibold ${
                    m.tipo === 'fondo' ? 'text-blue-600' : 'text-amber-600'
                  }`}
                >
                  {m.tipo === 'fondo' ? '+' : '−'}${fmtMoney(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}

        {turno.movimientos.length === 0 && (
          <p className="px-4 py-3 text-xs text-text-3">Sin movimientos en este turno.</p>
        )}
      </div>

      {/* ── Sheet: Registrar movimiento ─────────────────────────────────────── */}
      {sheetMovimiento && (
        <>
          <div
            className="fixed inset-0 z-[65] bg-black/40"
            onClick={() => setSheetMovimiento(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl bg-white max-h-[85vh] flex flex-col">
            <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[16px] font-bold">
                {sheetMovimiento === 'fondo' ? '💰 Depositar a caja' : '🏦 Retirar de caja'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Monto
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[22px] font-bold text-text-3">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step="0.01"
                    value={montoMov}
                    onChange={(e) => setMontoMov(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-4 pl-10 pr-4 font-mono text-[22px] font-bold outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Nota (opcional)
                </label>
                <textarea
                  value={notasMov}
                  onChange={(e) => setNotasMov(e.target.value)}
                  placeholder="Ej: cambio para el día, pago de proveedor…"
                  rows={2}
                  className="w-full resize-none rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>
              {errorMov && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{errorMov}</p>
              )}
            </div>
            <div className="flex-shrink-0 px-4 py-4 border-t border-[#E5E5EA] space-y-2.5">
              <button
                onClick={handleRegistrarMovimiento}
                disabled={isPendingMov}
                className={`w-full rounded-xl py-[15px] text-[15px] font-bold text-white active:scale-[.98] disabled:opacity-40 ${
                  sheetMovimiento === 'fondo'
                    ? 'bg-blue-600 shadow-[0_4px_14px_rgba(37,99,235,.28)]'
                    : 'bg-amber-500 shadow-[0_4px_14px_rgba(245,158,11,.28)]'
                }`}
              >
                {isPendingMov ? 'Guardando…' : sheetMovimiento === 'fondo' ? 'Confirmar depósito' : 'Confirmar retiro'}
              </button>
              <button
                onClick={() => setSheetMovimiento(null)}
                className="w-full rounded-xl bg-s2 py-[15px] text-[15px] font-semibold text-text-2 active:scale-[.98]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3.5 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Advertencia no bloqueante: diferencia por encima del umbral configurado */}
      {confirmandoCierre && diferenciaExcedeUmbral && diferencia !== null && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3.5 space-y-2">
          <p className="text-sm font-bold text-amber-800">
            ⚠️ Diferencia de ${fmtMoney(Math.abs(diferencia))} {diferencia > 0 ? '(sobrante)' : '(faltante)'}
          </p>
          <p className="text-xs text-amber-700">
            Supera el umbral de ${fmtMoney(diferenciaAlertaMonto)} configurado en Permisos. Puedes cerrar
            de todas formas, o cancelar y revisar el conteo antes de continuar.
          </p>
          <button
            onClick={() => setConfirmandoCierre(false)}
            className="w-full rounded-xl bg-white border border-amber-300 py-2.5 text-sm font-semibold text-amber-800 active:scale-[.98]"
          >
            Revisar de nuevo
          </button>
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
        {isPending
          ? 'Cerrando turno…'
          : confirmandoCierre && diferenciaExcedeUmbral
            ? 'Sí, cerrar de todas formas'
            : '⏹ Cerrar turno'}
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
