'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Banknote, CreditCard, Smartphone, CirclePlus, Users, User, UserRoundPlus, Split,
  ChevronUp, ChevronDown, Printer, Lock, Check, X, PiggyBank,
} from 'lucide-react'
import {
  cobrarPedido,
  anularPedido,
  marcarPrecuentaImpresa,
  type PagoInput,
} from '@/app/(app)/cobro/[pedidoId]/actions'
import type { SubpedidoCobro } from '@/app/(app)/cobro/[pedidoId]/page'
import { imprimirTicket, consolidarItemsCliente, type TicketConfig } from '@/lib/print'
import { HeaderB } from '@/components/ui/HeaderB'
import { Boton } from '@/components/ui/Boton'
import { formatCurrency } from '@/components/ui/tokens'

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
  // Datos de servicio para el bloque de encabezado del ticket de cliente
  // (ver DatosServicioTicket en lib/print.ts) — mesero ya resuelto vía
  // primerNombreValido() en la page, no se recalcula aquí.
  mesero: string
  orden: string
  tipoMesa: 'mesa' | 'llevar' | 'mostrador'
  numComensales: number | null
  clienteNombre: string | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────
// Iconos lucide-react en vez de emoji — mismo criterio de "Modo captura
// rápida"/Menú (reemplazar emoji por lucide donde el mockup muestra un
// ícono real, no una decoración tipográfica).

const METODOS: { id: Metodo; label: string; Icon: typeof Banknote }[] = [
  { id: 'efectivo', label: 'Efectivo', Icon: Banknote },
  { id: 'tarjeta', label: 'Tarjeta', Icon: CreditCard },
  { id: 'transferencia', label: 'Transferencia', Icon: Smartphone },
  { id: 'mixto', label: 'Mixto', Icon: CirclePlus },
]

const ESCENARIOS: { id: Escenario; label: string; desc: string; Icon: typeof Users }[] = [
  { id: 'general', label: 'Cuenta general', desc: 'Se cobrará un solo pago por toda la mesa.', Icon: Users },
  { id: 'individual', label: 'Individual', desc: 'Cada comensal paga su consumo.', Icon: User },
  { id: 'varios', label: 'Uno paga varios', desc: 'Un comensal paga por los demás.', Icon: UserRoundPlus },
  { id: 'dividir', label: 'Dividir igual', desc: 'El total se divide en partes iguales.', Icon: Split },
]

// Tintes puramente decorativos para diferenciar comensales a simple vista —
// no tienen significado operativo (a diferencia del semáforo de mesa en
// lib/colorMesa.ts, que nunca se reutiliza para esto).
const TINTES_COMENSAL = [
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-800',
  'bg-indigo-100 text-indigo-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
]

// Billetes comunes en México
const BILLETES_MX = [100, 200, 500, 1000, 2000]

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// Redondeo de propina al peso entero más cercano: .01-.49 baja, .50-.99 sube.
// Así la propina nunca queda con centavos sueltos en la cuenta.
function roundPropina(n: number) {
  return Math.round(n)
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
  mesero,
  orden,
  tipoMesa,
  numComensales,
  clienteNombre,
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

  // ── Desglose por comensal (tarjeta "Total a cobrar") — abierto por
  // defecto, puramente visual (no oculta nada nuevo, solo permite
  // colapsarlo si estorba). ──────────────────────────────────────────────────
  const [mostrarDesglose, setMostrarDesglose] = useState(true)

  // ── Descuento ─────────────────────────────────────────────────────────────
  const [descuentoPct, setDescuentoPct] = useState('')
  const descuentoInputRef = useRef<HTMLInputElement>(null)

  // ── Método de pago ─────────────────────────────────────────────────────────
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [conPropina, setConPropina] = useState(false)
  const [imprimirTicketPago, setImprimirTicketPago] = useState(false)

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

  const propinaAmt = conPropina ? roundPropina(totalConDescuento * propinaPct / 100) : 0
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

  // Quick chips para efectivo — denominaciones reales (BILLETES_MX), no las
  // del mockup ($250/$300, que no existen en la lista real).
  const chipsRapidos = [
    { label: 'Exacto', valor: total },
    ...BILLETES_MX.filter((b) => b > total)
      .slice(0, 4)
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

      // Cobro exitoso — imprimir ticket de pago de cliente (si el usuario lo pidió)
      if (imprimirTicketPago) {
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
            mesero,
            orden,
            tipoMesa,
            numComensales,
            clienteNombre,
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
          const printItems = consolidarItemsCliente(
            escenario === 'varios'
              ? subpedidosACobrar.flatMap((sp) => sp.items)
              : itemsTicket,
          )

          const printEscenario =
            escenario === 'general' ? 'global' : escenario

          printOk = await imprimirTicket({
            tipo: 'cliente',
            escenario: printEscenario,
            mesa: mesaLabel,
            mesero,
            orden,
            tipoMesa,
            numComensales,
            clienteNombre,
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

  async function handleImprimirCuenta() {
    let ok: boolean
    if (escenario === 'individual') {
      // Imprime un ticket separado por cada comensal
      ok = await imprimirTicket({
        tipo: 'cliente',
        escenario: 'individual',
        mesa: mesaLabel,
        mesero,
        orden,
        tipoMesa,
        numComensales,
        clienteNombre,
        config: ticketConfig,
        comensales: subpedidos.map((sp) => ({
          comensalNombre: sp.nombre ?? `Comensal ${sp.comensal_numero}`,
          items: sp.items,
          subtotal: sp.total,
          total: sp.total,
        })),
      }, impresionActiva)
    } else {
      // Pre-cuenta: si es "Uno paga varios", solo los comensales
      // seleccionados — no toda la mesa. "Cuenta general" y
      // "Dividir igual" sí muestran todo, porque ahí aplica a todos.
      const precuentaItems = consolidarItemsCliente(
        escenario === 'varios'
          ? subpedidos
              .filter((sp) => subSeleccionados.has(sp.id))
              .flatMap((sp) => sp.items)
          : itemsTicket,
      )

      const propinaPreCuenta = conPropina && propinaPct > 0
        ? roundPropina(totalConDescuento * propinaPct / 100)
        : 0
      ok = await imprimirTicket({
        tipo: 'cliente',
        escenario: 'precuenta',
        mesa: mesaLabel,
        mesero,
        orden,
        tipoMesa,
        numComensales,
        clienteNombre,
        items: precuentaItems,
        subtotal: totalConDescuento,
        propina: propinaPreCuenta,
        total: round2(totalConDescuento + propinaPreCuenta),
        metodo: '',
        recibido: null,
        cambio: null,
        config: ticketConfig,
      }, impresionActiva)

      if (ok) {
        await marcarPrecuentaImpresa(pedidoId)
      }
    }
    if (!ok) setPrintError(true)
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

      {/* ── Header B ──────────────────────────────────────────────────────── */}
      {/* Sin badge de "Terminal conectada" del mockup — no existe ninguna
          integración real de terminal de pago (ver "Conciliación de
          terminal bancaria" en ESTADO_PROYECTO.md, listada como pendiente
          sin spec); mismo criterio que se aplicó a "Servir" en Pedidos. */}
      <HeaderB
        backLabel="Comanda"
        onBack={() => router.push(`/pos/${pedidoId}`)}
        titulo={mesaLabel}
        subtitulo={
          <p className="text-[13px] text-text-3">
            Cuenta #{orden}
            {numComensales ? ` · ${numComensales} comensal${numComensales !== 1 ? 'es' : ''}` : ''}
          </p>
        }
      />

      {/* ── Cuerpo scrolleable ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── Selector de escenario ──────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              ¿Quién paga?
            </p>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2.5">
            {ESCENARIOS.map((e) => {
              const activo = escenario === e.id
              return (
                <button
                  key={e.id}
                  onClick={() => handleCambiarEscenario(e.id)}
                  className={`relative rounded-xl p-3.5 text-left transition-all active:scale-[.98] ${
                    activo ? 'bg-[#173F2E] text-white' : 'bg-s2 text-text'
                  }`}
                >
                  {activo && (
                    <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#173F2E]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                  <e.Icon size={20} strokeWidth={2} className={activo ? 'text-white' : 'text-text-2'} />
                  <p className="mt-2 text-[14px] font-bold leading-tight">{e.label}</p>
                  <p className={`mt-0.5 text-[11px] leading-tight ${activo ? 'text-white/75' : 'text-text-3'}`}>
                    {e.desc}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Total a cobrar (expandible) + desglose por comensal ─────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <button
            onClick={() => setMostrarDesglose((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-4 active:bg-s2"
          >
            <p className="text-[15px] font-bold">Total a cobrar</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[20px] font-bold text-[#173F2E]">
                {formatCurrency(totalEscenario)}
              </span>
              {mostrarDesglose
                ? <ChevronUp size={18} strokeWidth={2.4} className="text-text-4" />
                : <ChevronDown size={18} strokeWidth={2.4} className="text-text-4" />}
            </div>
          </button>

          {mostrarDesglose && (
            <div className="border-t border-[#E5E5EA]">
              <div className="px-4 pt-3 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  {escenario === 'general' ? 'Cuenta' : 'Seleccionar comensales'}
                </p>
              </div>
              <div className="divide-y divide-[#F2F2F7]">
                {subpedidos.map((sp, idx) => {
                  const seleccionado = subSeleccionados.has(sp.id)
                  const mostrarCheck = escenario === 'individual' || escenario === 'varios'
                  const numProductos = sp.items.reduce((s, i) => s + i.cantidad, 0)

                  return (
                    <button
                      key={sp.id}
                      onClick={() => mostrarCheck ? toggleSubpedido(sp.id) : undefined}
                      disabled={!mostrarCheck}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        mostrarCheck
                          ? seleccionado ? 'bg-[#173F2E]/5' : 'active:bg-s2'
                          : ''
                      }`}
                    >
                      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${TINTES_COMENSAL[idx % TINTES_COMENSAL.length]}`}>
                        {sp.comensal_numero}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-text">
                          {sp.nombre ?? `Comensal ${sp.comensal_numero}`}
                        </p>
                        <p className="text-[12px] text-text-3">
                          {numProductos} producto{numProductos !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="font-mono text-[14px] font-bold text-[#173F2E]">
                        {formatCurrency(sp.total)}
                      </span>
                      {/* El ícono de persona también es el indicador de
                          selección en individual/varios (evita duplicar un
                          check aparte) — en general/dividir es solo
                          decorativo, no hay drill-down por comensal. */}
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                          mostrarCheck && seleccionado
                            ? 'bg-[#173F2E] text-white'
                            : 'bg-s2 text-text-3'
                        }`}
                      >
                        {mostrarCheck && seleccionado
                          ? <Check size={15} strokeWidth={3} />
                          : <User size={15} strokeWidth={2.2} />}
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
                      className="w-20 rounded-xl border-[1.5px] border-border bg-s2 px-3 py-2 text-center font-mono text-sm font-bold outline-none focus:border-[#173F2E]"
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
                      className="w-20 rounded-xl border-[1.5px] border-border bg-s2 px-3 py-2 text-center font-mono text-sm font-bold outline-none focus:border-[#173F2E]"
                    />
                    <span className="text-sm text-text-3">
                      de {nPartes}
                    </span>
                  </div>
                  {parseInt(nPartes) >= 2 && (
                    <div className="rounded-xl bg-[#173F2E]/5 px-4 py-2.5 flex items-center justify-between">
                      <p className="text-xs text-[#173F2E]">Precio por parte</p>
                      <span className="font-mono text-sm font-bold text-[#173F2E]">
                        {formatCurrency(round2(totalPedido / (parseInt(nPartes) || 1)))}
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
                <span className="font-mono text-[18px] font-bold text-[#173F2E]">
                  {formatCurrency(totalEscenario)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Descuento ──────────────────────────────────────────────────── */}
        {descuentoHabilitado && totalEscenario > 0 && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Descuento
              </p>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    ref={descuentoInputRef}
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
                        : 'border-border focus:border-[#173F2E] focus:bg-white'
                    }`}
                  />
                </div>
                <span className="font-mono text-[22px] font-bold text-text-3">%</span>
              </div>

              {/* Chips rápidos — valores fijos razonables, no hay un
                  "modo monto fijo" real (el mockup sugiere $/% pero la
                  lógica solo soporta porcentaje) — ver resumen. */}
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDescuentoPct(String(pct))}
                    className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
                      numDescuentoPct === pct
                        ? 'border-[#173F2E] bg-[#173F2E]/5 text-[#173F2E]'
                        : 'border-border bg-s2 text-text-2'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                <button
                  onClick={() => descuentoInputRef.current?.focus()}
                  className="rounded-full border-[1.5px] border-border bg-s2 px-3.5 py-1.5 text-[13px] font-semibold text-text-2 active:scale-95"
                >
                  Otro
                </button>
              </div>

              {descuentoInvalido && (
                <div className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2">
                  <span className="text-xs font-bold text-red-600">Máx {descuentoMaxPct}%</span>
                </div>
              )}
              {numDescuentoPct > 0 && !descuentoInvalido && (
                <div className="flex items-center justify-between rounded-xl bg-[#173F2E]/5 px-4 py-2.5">
                  <p className="text-xs text-[#173F2E]">Descuento aplicado</p>
                  <span className="font-mono text-sm font-bold text-[#173F2E]">
                    −{formatCurrency(montoDescuento)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Botón Anular mesa (solo cuando total=0) ────────────────────── */}
        {mostrarAnular && (
          <Boton variant="peligro" onClick={handleAnular} disabled={isPendingAnular}>
            {isPendingAnular ? 'Anulando…' : 'Anular mesa (sin cobro)'}
          </Boton>
        )}

        {/* ── Propina sugerida ───────────────────────────────────────────── */}
        {/* El mockup muestra 5 chips de porcentaje (10/12/15/18/20%)
            seleccionables, pero solo existe UN porcentaje configurado
            (config_sistema.propina_sugerida_pct, /mas/permisos) — no hay
            varios niveles reales entre los que elegir. Se muestra ese único
            valor como una píldora dentro de la misma tarjeta-toggle que ya
            existía (tocar la tarjeta activa/desactiva la propina), en vez
            de fabricar 4 opciones más que no llevarían a ningún lado. */}
        {propinaPct > 0 && totalConDescuento > 0 && (
          <button
            onClick={() => setConPropina((v) => !v)}
            className={`w-full flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 transition-colors ${
              conPropina
                ? 'border-[#173F2E]/40 bg-[#173F2E]/5'
                : 'border-amber-200 bg-amber-50/60'
            }`}
          >
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${conPropina ? 'bg-[#173F2E]/10 text-[#173F2E]' : 'bg-amber-100 text-amber-700'}`}>
              <PiggyBank size={18} strokeWidth={2} />
            </span>
            <div className="flex-1 text-left">
              <p className={`text-sm font-semibold ${conPropina ? 'text-[#173F2E]' : 'text-text-1'}`}>
                Propina sugerida
              </p>
              <p className={`text-xs mt-0.5 ${conPropina ? 'text-[#173F2E]' : 'text-text-3'}`}>
                {conPropina
                  ? `+${formatCurrency(propinaAmt)} → Total: ${formatCurrency(total)}`
                  : 'Toca para aplicarla'}
              </p>
            </div>
            <span className="flex-shrink-0 rounded-full bg-[#173F2E] px-3 py-1.5 text-[13px] font-bold text-white">
              {propinaPct}%
            </span>
          </button>
        )}

        {/* ── Botón imprimir cuenta (etapa ANTES de cobrar — precuenta) ────── */}
        {!mostrarAnular && (
          <Boton variant="secundario" onClick={handleImprimirCuenta}>
            <Printer size={17} strokeWidth={2.2} />
            Imprimir cuenta
          </Boton>
        )}

        {/* ── Método de pago ─────────────────────────────────────────────── */}
        {!mostrarAnular && (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Método de pago
              </p>
            </div>
            {/* 2×2 en vez de las 4 columnas del mockup — con "Transferencia"
                (la etiqueta más larga) 4-en-línea se apretaba demasiado en
                pantallas angostas (iPhone SE); 2×2 ya es el patrón probado
                que traía esta pantalla. */}
            <div className="grid grid-cols-2 gap-2.5 p-3">
              {METODOS.map((m) => {
                const activo = metodo === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMetodo(m.id)
                      setReferencia('')
                    }}
                    className={`relative flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] py-3.5 px-3 transition-all active:scale-[.97] ${
                      activo
                        ? 'border-[#173F2E] bg-[#173F2E]/5'
                        : 'border-[#E5E5EA] bg-white'
                    }`}
                  >
                    <m.Icon size={22} strokeWidth={1.8} className={activo ? 'text-[#173F2E]' : 'text-text-3'} />
                    <span className={`text-[13px] font-semibold ${activo ? 'text-[#173F2E]' : 'text-text-2'}`}>
                      {m.label}
                    </span>
                    {activo && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#173F2E] text-white">
                        <Check size={10} strokeWidth={3.2} />
                      </span>
                    )}
                  </button>
                )
              })}
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

                <div className="flex items-stretch gap-3">
                  <div className="relative flex-1">
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
                      className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-4 pl-10 pr-4 font-mono text-[24px] font-bold outline-none focus:border-[#173F2E] focus:bg-white"
                    />
                  </div>

                  {numRecibido > 0 && (
                    <div
                      className={`flex w-[112px] flex-shrink-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-center ${
                        cambioEfectivo >= 0
                          ? 'bg-[#173F2E]/5 border border-[#173F2E]/15'
                          : 'bg-red-50 border border-red-100'
                      }`}
                    >
                      <p
                        className={`text-[11px] font-semibold ${
                          cambioEfectivo >= 0 ? 'text-[#173F2E]' : 'text-red-600'
                        }`}
                      >
                        {cambioEfectivo >= 0 ? 'Cambio' : 'Falta'}
                      </p>
                      <span
                        className={`font-mono text-[16px] font-bold leading-tight ${
                          cambioEfectivo >= 0 ? 'text-[#173F2E]' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(Math.abs(cambioEfectivo))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {chipsRapidos.map((chip) => (
                    <button
                      key={chip.valor}
                      onClick={() => setEfectivoRecibido(chip.valor.toString())}
                      className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
                        numRecibido === chip.valor
                          ? 'border-[#173F2E] bg-[#173F2E]/5 text-[#173F2E]'
                          : 'border-border bg-s2 text-text-2'
                      }`}
                    >
                      {chip.label === 'Exacto'
                        ? `Exacto (${formatCurrency(total)})`
                        : chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TARJETA */}
            {metodo === 'tarjeta' && (
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-[#173F2E]/5 px-4 py-3.5">
                  <CreditCard size={20} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-[#173F2E]" />
                  <div>
                    <p className="text-sm font-semibold text-[#173F2E]">
                      Pago con tarjeta
                    </p>
                    <p className="mt-0.5 text-xs text-[#173F2E]/80">
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
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
                  />
                </div>
              </div>
            )}

            {/* TRANSFERENCIA */}
            {metodo === 'transferencia' && (
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-violet-50 px-4 py-3.5">
                  <Smartphone size={20} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-violet-600" />
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
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#173F2E]/10 text-[#173F2E]">
                    <Banknote size={16} strokeWidth={2} />
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
                      className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-2.5 pl-7 pr-3 font-mono text-sm font-medium outline-none focus:border-[#173F2E]"
                    />
                  </div>
                  <span className="w-[72px] text-right text-xs font-medium text-text-3">
                    Efectivo
                  </span>
                </div>

                {/* Fila tarjeta */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#173F2E]/10 text-[#173F2E]">
                    <CreditCard size={16} strokeWidth={2} />
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
                      className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-2.5 pl-7 pr-3 font-mono text-sm font-medium outline-none focus:border-[#173F2E]"
                    />
                  </div>
                  <span className="w-[72px] text-right text-xs font-medium text-text-3">
                    Tarjeta
                  </span>
                </div>

                {/* Fila transferencia */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Smartphone size={16} strokeWidth={2} />
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
                        {formatCurrency(sumaMixto)}
                      </span>
                    </div>

                    {restanteMixto > 0.009 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-red-50">
                        <p className="text-[13px] font-semibold text-red-600">Falta</p>
                        <span className="font-mono text-[13px] font-bold text-red-600">
                          {formatCurrency(restanteMixto)}
                        </span>
                      </div>
                    )}

                    {restanteMixto <= 0.009 && cambioMixto > 0.009 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#173F2E]/5">
                        <p className="text-[13px] font-semibold text-[#173F2E]">
                          Cambio (efectivo)
                        </p>
                        <span className="font-mono text-[13px] font-bold text-[#173F2E]">
                          {formatCurrency(cambioMixto)}
                        </span>
                      </div>
                    )}

                    {restanteMixto <= 0.009 && cambioMixto <= 0.009 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#173F2E]/5">
                        <p className="text-[13px] font-semibold text-[#173F2E]">
                          Cubierto ✓
                        </p>
                        <span className="font-mono text-[13px] font-bold text-[#173F2E]">
                          {formatCurrency(0)}
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
          <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3.5 text-sm text-red-600 border border-red-100">
            <X size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0" />
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
            <span className="font-mono text-[22px] font-bold text-[#173F2E]">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Imprimir automáticamente — toggle iOS, de vuelta al pie fijo
              pegado al botón "Cobrar" (decisión de una ronda anterior: que
              nunca se pierda de vista sin hacer scroll). */}
          <button
            onClick={() => setImprimirTicketPago((v) => !v)}
            className="mb-3 flex w-full items-center gap-2.5 rounded-xl bg-s2 px-3.5 py-2.5 active:opacity-70"
          >
            <Printer size={16} strokeWidth={2} className="flex-shrink-0 text-text-2" />
            <span className="flex-1 text-left text-[13px] font-medium text-text-2">
              Imprimir ticket automáticamente
            </span>
            <span
              className={`relative h-6 w-[42px] flex-shrink-0 rounded-full transition-colors ${
                imprimirTicketPago ? 'bg-[#173F2E]' : 'bg-[#D1D1D6]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  imprimirTicketPago ? 'translate-x-[19px]' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          <button
            onClick={handleCobrar}
            disabled={!esValido || isPending}
            className="flex w-full flex-col items-center gap-0.5 rounded-xl bg-[#173F2E] py-[14px] text-white shadow-[0_4px_14px_rgba(23,63,46,.32)] active:scale-[.98] active:bg-[#0F2E21] disabled:opacity-40"
          >
            <span className="flex items-center gap-2 text-base font-bold">
              <Lock size={16} strokeWidth={2.4} />
              {isPending ? 'Procesando cobro…' : `Cobrar ${formatCurrency(total)}`}
            </span>
            {!isPending && (
              <span className="text-[12px] font-medium text-white/75">
                {METODOS.find((m) => m.id === metodo)?.label}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
