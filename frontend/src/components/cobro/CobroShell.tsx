'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  cobrarPedido,
  anularPedido,
  type PagoInput,
} from '@/app/(app)/cobro/[pedidoId]/actions'
import type { SubpedidoCobro } from '@/app/(app)/cobro/[pedidoId]/page'
import { imprimirTicket, type TicketConfig } from '@/lib/print'

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Metodo = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'
type Escenario = 'general' | 'individual' | 'varios' | 'dividir'

interface DatosBancarios {
  banco: string | null
  clabe: string | null
  titular: string | null
}

interface CobroShellProps {
  pedidoId: number
  turnoId: number
  mesaId: number | null
  mesaLabel: string
  subpedidos: SubpedidoCobro[]
  totalPedido: number
  propinaPct: number
  datosBancarios?: DatosBancarios
  descuentoHabilitado?: boolean
  descuentoMaxPct?: number
  ticketConfig: TicketConfig
  impresionActiva?: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const METODOS: { id: Metodo; label: string; emoji: string; activeClass: string }[] = [
  {
    id: 'efectivo',
    label: 'Efectivo',
    emoji: '💵',
    activeClass: 'bg-emerald-500 text-white shadow-[0_3px_10px_rgba(16,185,129,.35)]',
  },
  {
    id: 'tarjeta',
    label: 'Tarjeta',
    emoji: '💳',
    activeClass: 'bg-blue-600 text-white shadow-[0_3px_10px_rgba(37,99,235,.35)]',
  },
  {
    id: 'transferencia',
    label: 'Transf.',
    emoji: '📱',
    activeClass: 'bg-violet-600 text-white shadow-[0_3px_10px_rgba(124,58,237,.35)]',
  },
  {
    id: 'mixto',
    label: 'Mixto',
    emoji: '⊕',
    activeClass: 'bg-amber-500 text-white shadow-[0_3px_10px_rgba(245,158,11,.35)]',
  },
]

const ESCENARIOS: { id: Escenario; label: string }[] = [
  { id: 'general', label: 'Cuenta general' },
  { id: 'individual', label: 'Individual' },
  { id: 'varios', label: 'Uno paga varios' },
  { id: 'dividir', label: 'Dividir igual' },
]

// Billetes comunes en México
const BILLETES_MX = [100, 200, 500, 1000, 2000]

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CobroShell({
  pedidoId,
  turnoId,
  mesaId,
  mesaLabel,
  subpedidos,
  totalPedido,
  propinaPct,
  datosBancarios,
  descuentoHabilitado = false,
  descuentoMaxPct = 0,
  ticketConfig,
  impresionActiva = false,
}: CobroShellProps) {
  const itemsTicket = subpedidos.flatMap((sp) => sp.items)
  const router = useRouter()

  // ── Escenario de facturación ───────────────────────────────────────────────
  const [escenario, setEscenario] = useState<Escenario>('general')
  // Individual: un solo subpedido seleccionado
  const [subSeleccionados, setSubSeleccionados] = useState<Set<number>>(new Set())
  // Dividir: número de partes y cuántas pagar ahora
  const [nPartes, setNPartes] = useState('2')
  const [partesAPagar, setPartesAPagar] = useState('1')

  // ── Descuento ─────────────────────────────────────────────────────────────
  const [descuentoPct, setDescuentoPct] = useState('')

  // ── Método de pago ─────────────────────────────────────────────────────────
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [conPropina, setConPropina] = useState(false)

  // Efectivo
  const [efectivoRecibido, setEfectivoRecibido] = useState('')

  // Tarjeta / Transferencia
  const [referencia, setReferencia] = useState('')

  // Mixto
  const [mixtoEfectivo, setMixtoEfectivo] = useState('')
  const [mixtoTarjeta, setMixtoTarjeta] = useState('')
  const [mixtoTransfer, setMixtoTransfer] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [printError, setPrintError] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isPendingAnular, startAnular] = useTransition()

  useEffect(() => {
    if (printError) {
      const t = setTimeout(() => setPrintError(false), 4000)
      return () => clearTimeout(t)
    }
  }, [printError])

  // ── Cálculo del total según escenario ────────────────────────────────────
  const totalEscenario = (() => {
    if (escenario === 'general') return totalPedido
    if (escenario === 'individual' || escenario === 'varios') {
      return subpedidos
        .filter((sp) => subSeleccionados.has(sp.id))
        .reduce((s, sp) => s + sp.total, 0)
    }
    if (escenario === 'dividir') {
      const n = parseInt(nPartes) || 1
      const m = parseInt(partesAPagar) || 1
      const clamped = Math.min(m, n)
      return round2((totalPedido / n) * clamped)
    }
    return totalPedido
  })()

  const subpedidosACobrar = (() => {
    if (escenario === 'general' || escenario === 'dividir') return subpedidos
    return subpedidos.filter((sp) => subSeleccionados.has(sp.id))
  })()

  const numDescuentoPct = parseFloat(descuentoPct) || 0
  const descuentoInvalido =
    descuentoHabilitado && numDescuentoPct > 0 && numDescuentoPct > descuentoMaxPct
  const montoDescuento = descuentoHabilitado && !descuentoInvalido
    ? round2(totalEscenario * numDescuentoPct / 100)
    : 0
  const totalConDescuento = round2(totalEscenario - montoDescuento)

  const propinaAmt = conPropina ? round2(totalConDescuento * propinaPct / 100) : 0
  const total = round2(totalConDescuento + propinaAmt)

  // Efectivo
  const numRecibido = parseFloat(efectivoRecibido) || 0
  const cambioEfectivo = round2(numRecibido - total)

  // Mixto
  const numMixtoE = parseFloat(mixtoEfectivo) || 0
  const numMixtoT = parseFloat(mixtoTarjeta) || 0
  const numMixtoX = parseFloat(mixtoTransfer) || 0
  const sumaMixto = round2(numMixtoE + numMixtoT + numMixtoX)
  const restanteMixto = round2(total - sumaMixto)
  const porCubrirConEfectivo = Math.max(0, total - numMixtoT - numMixtoX)
  const cambioMixto = numMixtoE > porCubrirConEfectivo
    ? round2(numMixtoE - porCubrirConEfectivo)
    : 0

  // Quick chips para efectivo
  const chipsRapidos = [
    { label: 'Exacto', valor: total },
    ...BILLETES_MX.filter((b) => b > total)
      .slice(0, 3)
      .map((b) => ({ label: `$${b.toLocaleString('es-MX')}`, valor: b })),
  ]

  // Validación del botón cobrar
  const hayMetodo = metodo !== undefined
  const esValido = (() => {
    if (!hayMetodo) return false
    if (descuentoInvalido) return false
    if (total <= 0 && escenario !== 'dividir') return false
    switch (metodo) {
      case 'efectivo':      return numRecibido >= total
      case 'tarjeta':       return true
      case 'transferencia': return true
      case 'mixto':         return sumaMixto >= total && sumaMixto > 0
    }
  })()

  // Mostrar "Anular mesa" solo si todo el pedido es $0 en escenario general
  const mostrarAnular = totalPedido === 0 && escenario === 'general'

  // Mostrar datos bancarios
  const mostrarDatosBancarios =
    (metodo === 'transferencia' || (metodo === 'mixto' && numMixtoX > 0)) &&
    datosBancarios?.clabe

  // ── Helpers de selección ──────────────────────────────────────────────────
  function toggleSubpedido(id: number) {
    setSubSeleccionados((prev) => {
      const next = new Set(prev)
      if (escenario === 'individual') {
        // Solo uno a la vez
        return new Set([id])
      }
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleCambiarEscenario(e: Escenario) {
    setEscenario(e)
    setSubSeleccionados(new Set())
    setEfectivoRecibido('')
    setReferencia('')
    setMixtoEfectivo('')
    setMixtoTarjeta('')
    setMixtoTransfer('')
    setConPropina(false)
    setDescuentoPct('')
    setError(null)
  }

  // ── Handler principal ──────────────────────────────────────────────────────
  function handleCobrar() {
    setError(null)

    if ((escenario === 'individual' || escenario === 'varios') && subSeleccionados.size === 0) {
      setError('Selecciona al menos un comensal.')
      return
    }

    let pagos: PagoInput[] = []
    let efectivoRec: number | null = null
    let cambio: number | null = null

    switch (metodo) {
      case 'efectivo':
        pagos = [{ metodo: 'efectivo', monto: total }]
        efectivoRec = numRecibido
        cambio = cambioEfectivo
        break

      case 'tarjeta':
        pagos = [{ metodo: 'tarjeta', monto: total, referencia: referencia || null }]
        break

      case 'transferencia':
        pagos = [{ metodo: 'transferencia', monto: total, referencia: referencia || null }]
        break

      case 'mixto':
        if (numMixtoE > 0)
          pagos.push({ metodo: 'efectivo', monto: Math.min(numMixtoE, total - numMixtoT - numMixtoX) })
        if (numMixtoT > 0)
          pagos.push({ metodo: 'tarjeta', monto: numMixtoT })
        if (numMixtoX > 0)
          pagos.push({ metodo: 'transferencia', monto: numMixtoX })
        if (numMixtoE > 0) {
          efectivoRec = numMixtoE
          cambio = cambioMixto
        }
        break
    }

    startTransition(async () => {
      const result = await cobrarPedido({
        pedidoId,
        turnoId,
        mesaId,
        subpedidos: subpedidosACobrar.map((sp) => ({ id: sp.id, monto: sp.total })),
        totalCobrado: totalConDescuento,
        propina: propinaAmt,
        pagos,
        efectivoRecibido: efectivoRec,
        cambio,
        descuentoPct: numDescuentoPct > 0 ? numDescuentoPct : undefined,
        descuentoMonto: montoDescuento > 0 ? montoDescuento : undefined,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      // Cobro exitoso — imprimir ticket de cliente
      const metodoLabel = METODOS.find((m) => m.id === metodo)?.label ?? metodo
      const recibidoTicket =
        metodo === 'efectivo' ? (numRecibido > 0 ? numRecibido : null)
        : metodo === 'mixto' && numMixtoE > 0 ? numMixtoE
        : null
      const cambioTicket =
        metodo === 'efectivo' ? (cambioEfectivo > 0.005 ? cambioEfectivo : null)
        : metodo === 'mixto' ? (cambioMixto > 0.005 ? cambioMixto : null)
        : null

      let printOk: boolean
      if (escenario === 'individual') {
        // Un ticket por cada comensal (en esta llamada solo el cobrado)
        const sp = subpedidosACobrar[0]
        printOk = await imprimirTicket({
          tipo: 'cliente',
          escenario: 'individual',
          mesa: mesaLabel,
          config: ticketConfig,
          comensales: [
            {
              comensalNombre: sp?.nombre ?? `Comensal ${sp?.comensal_numero}`,
              items: sp?.items ?? [],
              subtotal: totalConDescuento,
              total,
              metodo: metodoLabel,
              recibido: recibidoTicket,
              cambio: cambioTicket,
            },
          ],
        }, impresionActiva)
      } else {
        const printItems =
          escenario === 'varios'
            ? subpedidosACobrar.flatMap((sp) => sp.items)
            : itemsTicket

        const printEscenario =
          escenario === 'general' ? 'global' : escenario

        printOk = await imprimirTicket({
          tipo: 'cliente',
          escenario: printEscenario,
          mesa: mesaLabel,
          items: printItems,
          subtotal: totalConDescuento,
          descuento: montoDescuento > 0 ? montoDescuento : undefined,
          propina: propinaAmt,
          total,
          metodo: metodoLabel,
          recibido: recibidoTicket,
          cambio: cambioTicket,
          config: ticketConfig,
          comensalesSeleccionados:
            escenario === 'varios'
              ? subpedidosACobrar.map(
                  (sp) => sp.nombre ?? `Comensal ${sp.comensal_numero}`,
                )
              : undefined,
          parteActual:
            escenario === 'dividir' ? (parseInt(partesAPagar) || 1) : undefined,
          totalPartes:
            escenario === 'dividir' ? (parseInt(nPartes) || 1) : undefined,
        }, impresionActiva)
      }

      if (!printOk) {
        setPrintError(true)
        await new Promise((r) => setTimeout(r, 2000))
      }

      router.push(result.redirectTo)
    })
  }

  function handleAnular() {
    setError(null)
    startAnular(async () => {
      const result = await anularPedido(pedidoId, mesaId)
      if (result?.error) setError(result.error)
    })
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col bg-s2"
      style={{ minHeight: 'calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))' }}
    >
      {printError && (
        <div className="fixed left-4 right-4 top-4 z-[100] rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          ⚠️ Sin conexión a impresora
        </div>
      )}
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#E5E5EA]">
        <div className="flex items-center gap-2 px-4 pt-3 pb-3">
          <button
            onClick={() => router.push(`/pos/${pedidoId}`)}
            className="-ml-1 px-1 py-1 text-[15px] font-medium text-blue-600 active:opacity-60"
          >
            ‹ Comanda
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[15px] font-semibold leading-tight truncate">
              {mesaLabel}
            </p>
            <p className="text-[11px] text-text-3">Cobro</p>
          </div>
          <div className="w-[64px]" />
        </div>
      </div>

      {/* ── Cuerpo scrolleable ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── Selector de escenario ──────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              ¿Quién paga?
            </p>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {ESCENARIOS.map((e) => (
              <button
                key={e.id}
                onClick={() => handleCambiarEscenario(e.id)}
                className={`rounded-xl py-2.5 px-3 text-[13px] font-semibold transition-all active:scale-[.97] ${
                  escenario === e.id
                    ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,.3)]'
                    : 'bg-s2 text-text-2'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Resumen de cuenta ──────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-[#E5E5EA]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              {escenario === 'general' ? 'Cuenta' : 'Seleccionar comensales'}
            </p>
          </div>
          <div className="divide-y divide-[#F2F2F7]">
            {subpedidos.map((sp) => {
              const seleccionado = subSeleccionados.has(sp.id)
              const mostrarCheck = escenario === 'individual' || escenario === 'varios'

              return (
                <button
                  key={sp.id}
                  onClick={() => mostrarCheck ? toggleSubpedido(sp.id) : undefined}
                  disabled={!mostrarCheck}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    mostrarCheck
                      ? seleccionado
                        ? 'bg-blue-50'
                        : 'active:bg-s2'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {mostrarCheck && (
                      <div
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 text-[10px] font-bold text-white transition-all ${
                          escenario === 'individual' ? 'rounded-full' : 'rounded-[4px]'
                        } ${
                          seleccionado
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-border'
                        }`}
                      >
                        {seleccionado && '✓'}
                      </div>
                    )}
                    <p className="text-sm text-text-2">
                      {sp.nombre ?? `Comensal ${sp.comensal_numero}`}
                    </p>
                  </div>
                  <span className={`font-mono text-sm font-medium ${
                    mostrarCheck && seleccionado ? 'text-blue-700' : ''
                  }`}>
                    ${sp.total.toFixed(2)}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Dividir equal UI */}
          {escenario === 'dividir' && (
            <div className="px-4 py-3 border-t border-[#E5E5EA] space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 flex-1">Dividir entre</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={20}
                  value={nPartes}
                  onChange={(e) => setNPartes(e.target.value)}
                  className="w-20 rounded-xl border-[1.5px] border-border bg-s2 px-3 py-2 text-center font-mono text-sm font-bold outline-none focus:border-blue-500"
                />
                <span className="text-sm text-text-3">personas</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 flex-1">Partes a pagar ahora</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={parseInt(nPartes) || 1}
                  value={partesAPagar}
                  onChange={(e) => setPartesAPagar(e.target.value)}
                  className="w-20 rounded-xl border-[1.5px] border-border bg-s2 px-3 py-2 text-center font-mono text-sm font-bold outline-none focus:border-blue-500"
                />
                <span className="text-sm text-text-3">
                  de {nPartes}
                </span>
              </div>
              {parseInt(nPartes) >= 2 && (
                <div className="rounded-xl bg-blue-50 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs text-blue-600">Precio por parte</p>
                  <span className="font-mono text-sm font-bold text-blue-700">
                    ${round2(totalPedido / (parseInt(nPartes) || 1)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Total del escenario */}
          <div className="flex items-center justify-between bg-s2 px-4 py-3.5">
            <p className="text-[15px] font-bold">
              {escenario === 'individual' || escenario === 'varios'
                ? 'Subtotal seleccionado'
                : 'Total'}
            </p>
            <span className="font-mono text-[22px] font-bold text-green-600">
              ${totalEscenario.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ── Descuento ──────────────────────────────────────────────────── */}
        {descuentoHabilitado && totalEscenario > 0 && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Descuento
              </p>
            </div>
            <div className="px-4 py-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={1}
                    value={descuentoPct}
                    onChange={(e) => setDescuentoPct(e.target.value)}
                    placeholder="0"
                    className={`w-full rounded-xl border-[1.5px] bg-s2 px-3.5 py-3 text-center font-mono text-[22px] font-bold outline-none ${
                      descuentoInvalido
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-border focus:border-blue-500 focus:bg-white'
                    }`}
                  />
                </div>
                <span className="font-mono text-[22px] font-bold text-text-3">%</span>
              </div>
              {descuentoInvalido && (
                <div className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2">
                  <span className="text-xs font-bold text-red-600">Máx {descuentoMaxPct}%</span>
                </div>
              )}
              {numDescuentoPct > 0 && !descuentoInvalido && (
                <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5">
                  <p className="text-xs text-blue-600">Descuento aplicado</p>
                  <span className="font-mono text-sm font-bold text-blue-700">
                    −${montoDescuento.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Botón Anular mesa (solo cuando total=0) ────────────────────── */}
        {mostrarAnular && (
          <button
            onClick={handleAnular}
            disabled={isPendingAnular}
            className="w-full rounded-2xl bg-red-600 py-4 text-base font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,.35)] active:scale-[.98] disabled:opacity-40"
          >
            {isPendingAnular ? 'Anulando…' : 'Anular mesa (sin cobro)'}
          </button>
        )}

        {/* ── Propina sugerida ───────────────────────────────────────────── */}
        {propinaPct > 0 && totalConDescuento > 0 && (
          <button
            onClick={() => setConPropina((v) => !v)}
            className={`w-full flex items-center justify-between rounded-2xl border-[1.5px] px-4 py-3.5 transition-colors ${
              conPropina
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-[#D1D1D6] bg-white'
            }`}
          >
            <div className="text-left">
              <p className={`text-sm font-semibold ${conPropina ? 'text-emerald-700' : 'text-text-1'}`}>
                Propina sugerida ({propinaPct}%)
              </p>
              <p className={`text-xs mt-0.5 ${conPropina ? 'text-emerald-600' : 'text-text-3'}`}>
                +${propinaAmt.toFixed(2)} → Total: ${total.toFixed(2)}
              </p>
            </div>
            <div
              className={`flex h-[24px] w-[24px] flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold text-white transition-all ${
                conPropina
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-border'
              }`}
            >
              {conPropina && '✓'}
            </div>
          </button>
        )}

        {/* ── Botón imprimir cuenta ──────────────────────────────────────── */}
        {!mostrarAnular && (
          <button
            onClick={async () => {
              let ok: boolean
              if (escenario === 'individual') {
                // Imprime un ticket separado por cada comensal
                ok = await imprimirTicket({
                  tipo: 'cliente',
                  escenario: 'individual',
                  mesa: mesaLabel,
                  config: ticketConfig,
                  comensales: subpedidos.map((sp) => ({
                    comensalNombre: sp.nombre ?? `Comensal ${sp.comensal_numero}`,
                    items: sp.items,
                    subtotal: sp.total,
                    total: sp.total,
                  })),
                }, impresionActiva)
              } else {
                // Pre-cuenta global
                const propinaPreCuenta = propinaPct > 0
                  ? round2(totalConDescuento * propinaPct / 100)
                  : 0
                ok = await imprimirTicket({
                  tipo: 'cliente',
                  escenario: 'precuenta',
                  mesa: mesaLabel,
                  items: itemsTicket,
                  subtotal: totalConDescuento,
                  propina: propinaPreCuenta,
                  total: round2(totalConDescuento + propinaPreCuenta),
                  metodo: '',
                  recibido: null,
                  cambio: null,
                  config: ticketConfig,
                }, impresionActiva)
              }
              if (!ok) setPrintError(true)
            }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[#D1D1D6] bg-white py-3.5 text-[15px] font-semibold text-text-2 active:bg-s2 active:scale-[.98]"
          >
            🖨️ Imprimir cuenta
          </button>
        )}

        {/* ── Método de pago ─────────────────────────────────────────────── */}
        {!mostrarAnular && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Método de pago
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-3">
              {METODOS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMetodo(m.id)
                    setReferencia('')
                  }}
                  className={`flex items-center gap-2.5 rounded-xl py-3.5 px-3.5 text-left transition-all active:scale-[.97] ${
                    metodo === m.id
                      ? m.activeClass
                      : 'bg-s2 text-text-2'
                  }`}
                >
                  <span className="text-[22px] leading-none">{m.emoji}</span>
                  <span className="text-[14px] font-semibold leading-tight">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Panel dinámico ─────────────────────────────────────────────── */}
        {!mostrarAnular && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">

            {/* EFECTIVO */}
            {metodo === 'efectivo' && (
              <div className="p-4 space-y-4">
                <p className="text-[13px] font-semibold text-text-3 uppercase tracking-wide">
                  Cantidad recibida
                </p>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[24px] font-bold text-text-3">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={efectivoRecibido}
                    onChange={(e) => setEfectivoRecibido(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-4 pl-10 pr-4 font-mono text-[24px] font-bold outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {chipsRapidos.map((chip) => (
                    <button
                      key={chip.valor}
                      onClick={() => setEfectivoRecibido(chip.valor.toString())}
                      className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
                        numRecibido === chip.valor
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-border bg-s2 text-text-2'
                      }`}
                    >
                      {chip.label === 'Exacto'
                        ? `Exacto $${total.toFixed(2)}`
                        : chip.label}
                    </button>
                  ))}
                </div>

                {numRecibido > 0 && (
                  <div
                    className={`flex items-center justify-between rounded-xl px-4 py-3.5 ${
                      cambioEfectivo >= 0
                        ? 'bg-emerald-50 border border-emerald-100'
                        : 'bg-red-50 border border-red-100'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${
                        cambioEfectivo >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {cambioEfectivo >= 0 ? 'Cambio' : 'Falta'}
                    </p>
                    <span
                      className={`font-mono text-[22px] font-bold ${
                        cambioEfectivo >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      ${Math.abs(cambioEfectivo).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TARJETA */}
            {metodo === 'tarjeta' && (
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3.5">
                  <span className="mt-0.5 text-[20px]">💳</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">
                      Pago con tarjeta
                    </p>
                    <p className="mt-0.5 text-xs text-blue-600">
                      Procesa el cobro en la terminal bancaria.
                      No se genera cambio.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                    Referencia / No. de aprobación (opcional)
                  </label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ej: 123456"
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* TRANSFERENCIA */}
            {metodo === 'transferencia' && (
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-violet-50 px-4 py-3.5">
                  <span className="mt-0.5 text-[20px]">📱</span>
                  <div>
                    <p className="text-sm font-semibold text-violet-800">
                      Pago por transferencia
                    </p>
                    <p className="mt-0.5 text-xs text-violet-600">
                      Verifica que la transferencia haya sido recibida.
                      No se genera cambio.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                    Referencia / Clave de rastreo (opcional)
                  </label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ej: SPEI 2024-xxxxxx"
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            )}

            {/* MIXTO */}
            {metodo === 'mixto' && (
              <div className="p-4 space-y-3">
                <p className="text-[13px] font-semibold text-text-3 uppercase tracking-wide">
                  Distribución del pago
                </p>

                {/* Fila efectivo */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[18px]">
                    💵
                  </div>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-3">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={mixtoEfectivo}
                      onChange={(e) => setMixtoEfectivo(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-2.5 pl-7 pr-3 font-mono text-sm font-medium outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="w-[72px] text-right text-xs font-medium text-text-3">
                    Efectivo
                  </span>
                </div>

                {/* Fila tarjeta */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[18px]">
                    💳
                  </div>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-3">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={mixtoTarjeta}
                      onChange={(e) => setMixtoTarjeta(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-2.5 pl-7 pr-3 font-mono text-sm font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <span className="w-[72px] text-right text-xs font-medium text-text-3">
                    Tarjeta
                  </span>
                </div>

                {/* Fila transferencia */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50 text-[18px]">
                    📱
                  </div>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-3">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={mixtoTransfer}
                      onChange={(e) => setMixtoTransfer(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-2.5 pl-7 pr-3 font-mono text-sm font-medium outline-none focus:border-violet-500"
                    />
                  </div>
                  <span className="w-[72px] text-right text-xs font-medium text-text-3">
                    Transf.
                  </span>
                </div>

                {/* Resumen mixto */}
                {sumaMixto > 0 && (
                  <div className="mt-1 rounded-xl border border-[#E5E5EA] divide-y divide-[#F2F2F7]">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-[13px] text-text-2">Asignado</p>
                      <span className="font-mono text-[13px] font-semibold">
                        ${sumaMixto.toFixed(2)}
                      </span>
                    </div>

                    {restanteMixto > 0.009 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-red-50">
                        <p className="text-[13px] font-semibold text-red-600">Falta</p>
                        <span className="font-mono text-[13px] font-bold text-red-600">
                          ${restanteMixto.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {restanteMixto <= 0.009 && cambioMixto > 0.009 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50">
                        <p className="text-[13px] font-semibold text-emerald-700">
                          Cambio (efectivo)
                        </p>
                        <span className="font-mono text-[13px] font-bold text-emerald-600">
                          ${cambioMixto.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {restanteMixto <= 0.009 && cambioMixto <= 0.009 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50">
                        <p className="text-[13px] font-semibold text-emerald-700">
                          Cubierto ✓
                        </p>
                        <span className="font-mono text-[13px] font-bold text-emerald-600">
                          $0.00
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Card datos bancarios ────────────────────────────────────────── */}
        {mostrarDatosBancarios && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Datos para transferencia
              </p>
            </div>
            <div className="px-4 py-4 space-y-3">
              {datosBancarios?.banco && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-3">Banco</p>
                  <p className="text-sm font-semibold">{datosBancarios.banco}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-3">CLABE</p>
                <p className="font-mono text-sm font-bold tracking-wider">
                  {datosBancarios?.clabe}
                </p>
              </div>
              {datosBancarios?.titular && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-3">Titular</p>
                  <p className="text-sm font-semibold">{datosBancarios.titular}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3.5 text-sm text-red-600 border border-red-100">
            {error}
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* ── Pie fijo ──────────────────────────────────────────────────────── */}
      {!mostrarAnular && (
        <div className="flex-shrink-0 border-t border-[#E5E5EA] bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] text-text-3">
              {conPropina ? `Con propina (${propinaPct}%)` : 'Total a cobrar'}
            </p>
            <span className="font-mono text-[22px] font-bold text-green-600">
              ${total.toFixed(2)}
            </span>
          </div>

          <button
            onClick={handleCobrar}
            disabled={!esValido || isPending}
            className="w-full rounded-xl bg-green-600 py-[18px] text-base font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,.35)] active:scale-[.98] disabled:opacity-40"
          >
            {isPending
              ? 'Procesando cobro…'
              : `✓ Cobrar $${total.toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  )
}
