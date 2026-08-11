'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, ChevronDown, ChevronRight, Check, Download, Armchair,
  Banknote, CreditCard, Smartphone, CirclePlus, Users, Package, Printer, RotateCcw, X,
} from 'lucide-react'
import type { ReciboData, PagoResumen, TurnoItem } from '@/app/(app)/historial/page'
import { reimprimirTicketCliente, reabrirPedido } from '@/app/(app)/historial/actions'
import { HeaderA } from '@/components/ui/HeaderA'
import { Boton } from '@/components/ui/Boton'
import { formatCurrency } from '@/components/ui/tokens'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const METODO_INFO: Record<PagoResumen['metodo'], { label: string; Icon: typeof Banknote }> = {
  efectivo: { label: 'Efectivo', Icon: Banknote },
  tarjeta: { label: 'Tarjeta', Icon: CreditCard },
  transferencia: { label: 'Transferencia', Icon: Smartphone },
}

// Tintes puramente decorativos para el ícono de mesa — a propósito NO son
// los colores del semáforo de mesa (lib/colorMesa.ts): estos son recibos ya
// cerrados en el pasado, no ocupación en vivo, y CLAUDE.md es explícito en
// que ese semáforo nunca se reutiliza para el ciclo de vida de un pedido.
const TINTES_MESA = [
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
]

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportarCSV(recibos: ReciboData[], turnoId: number | null) {
  const header = 'ID,Hora,Mesa,Mesero,Comensales,Productos,Total,Efectivo recibido,Cambio,Métodos'
  const rows = recibos.map((r) => {
    const metodos = r.pagos.map((p) => `${p.metodo}:$${p.monto.toFixed(2)}`).join(' | ')
    return [
      r.id,
      new Date(r.createdAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
      `"${r.mesaLabel}"`,
      `"${r.meseroNombre}"`,
      r.numComensales,
      r.numProductos,
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
  turnoActivoId,
  isAdmin,
  esTurnoActivo,
}: {
  recibos: ReciboData[]
  sinTurno: boolean
  turnos: TurnoItem[]
  turnoSeleccionadoId: number | null
  turnoActivoId: number | null
  isAdmin: boolean
  esTurnoActivo: boolean
}) {
  const router = useRouter()
  const [seleccionado, setSeleccionado] = useState<ReciboData | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const turnoActual = turnos.find((t) => t.id === turnoSeleccionadoId)
  const turnoLabel = turnoActual
    ? `Turno #${turnoActual.id} · ${fmtFechaCorta(turnoActual.abierto_en)} ${fmtHora(turnoActual.abierto_en)}`
    : esTurnoActivo ? 'Turno activo' : 'Historial de cobros'

  const recibosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return recibos
    return recibos.filter((r) => {
      const campos = [r.mesaLabel, String(r.id), r.meseroNombre, r.clienteNombre ?? '']
      return campos.some((c) => c.toLowerCase().includes(q))
    })
  }, [recibos, busqueda])

  const totalVentas = recibosFiltrados.reduce((s, r) => s + r.total, 0)

  function handleSeleccionarTurno(id: number) {
    setSelectorOpen(false)
    router.push(`/historial?turno=${id}`)
  }

  return (
    <div className="min-h-full bg-s2">
      <HeaderA titulo="Historial" subtitulo="Historial de cobros" turnoId={turnoActivoId} />

      {/* Selector de turno (admin) + exportar CSV */}
      <div className="flex items-center gap-2 border-b border-[#E5E5EA] bg-white px-4 pb-3 pt-3">
        {isAdmin && turnos.length > 0 ? (
          <button
            onClick={() => setSelectorOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-2.5 text-left active:opacity-70"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
              {turnoLabel}
            </span>
            <ChevronDown size={15} strokeWidth={2.4} className="flex-shrink-0 text-text-3" />
          </button>
        ) : (
          <p className="flex-1 text-[13px] text-text-3">Cobros del turno activo</p>
        )}
        {recibos.length > 0 && (
          <button
            onClick={() => exportarCSV(recibosFiltrados, turnoSeleccionadoId)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-s2 px-3.5 py-2.5 text-[13px] font-semibold text-text-2 active:bg-s3"
          >
            <Download size={15} strokeWidth={2.4} />
            CSV
          </button>
        )}
      </div>

      {/* Búsqueda — sin ícono de escaneo: no existe ninguna función real de
          escaneo aquí, mismo criterio ya aplicado en Menú/Pedidos/Cobro. */}
      {!sinTurno && recibos.length > 0 && (
        <div className="border-b border-[#E5E5EA] bg-white px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-s2 px-3 py-2.5">
            <Search size={17} strokeWidth={2.2} className="flex-shrink-0 text-text-3" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por mesa, ticket, cliente o mesero…"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-text placeholder:text-text-3 focus:outline-none"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="flex-shrink-0 text-text-3 active:opacity-60">
                <X size={15} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-4">
        {sinTurno ? (
          <SinTurnoState />
        ) : recibos.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] text-text-3">
                Mostrando <span className="font-semibold text-text-2">{recibosFiltrados.length}</span> registro{recibosFiltrados.length !== 1 ? 's' : ''}
              </p>
              <p className="text-[13px] text-text-3">
                Total ventas: <span className="font-mono text-[14px] font-bold text-[#173F2E]">{formatCurrency(totalVentas)}</span>
              </p>
            </div>

            {recibosFiltrados.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-3">Sin resultados para tu búsqueda.</p>
            ) : (
              <div className="space-y-2.5">
                {recibosFiltrados.map((r, idx) => (
                  <ReciboCard
                    key={r.id}
                    recibo={r}
                    tinte={TINTES_MESA[idx % TINTES_MESA.length]}
                    onVer={() => setSeleccionado(r)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom sheet: detalle de recibo */}
      {seleccionado && (
        <ReciboSheet
          recibo={seleccionado}
          puedeReabrir={isAdmin && esTurnoActivo}
          onClose={() => setSeleccionado(null)}
          onReabierto={() => {
            setSeleccionado(null)
            router.refresh()
          }}
        />
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
                    t.id === turnoSeleccionadoId ? 'bg-[#173F2E]/5' : ''
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
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#173F2E]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#173F2E]" />
                        Activo
                      </span>
                    )}
                    {t.id === turnoSeleccionadoId && (
                      <Check size={16} strokeWidth={2.6} className="text-[#173F2E]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 px-5 py-4 border-t border-[#E5E5EA]">
              <Boton variant="secundario" onClick={() => setSelectorOpen(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tarjeta de recibo ────────────────────────────────────────────────────────

function ReciboCard({
  recibo: r,
  tinte,
  onVer,
}: {
  recibo: ReciboData
  tinte: string
  onVer: () => void
}) {
  return (
    <button
      onClick={onVer}
      className="flex w-full items-start gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-card active:opacity-80"
    >
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tinte}`}>
        <Armchair size={20} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-tight text-text">{r.mesaLabel}</p>
        <p className="mt-0.5 text-[12px] text-text-3">
          #{r.id} · {fmtHora(r.createdAt)} · {r.meseroNombre}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[12px] text-text-3">
          <Users size={11} strokeWidth={2.2} />
          {r.numComensales} comensal{r.numComensales !== 1 ? 'es' : ''}
          <span className="mx-0.5">·</span>
          <Package size={11} strokeWidth={2.2} />
          {r.numProductos} producto{r.numProductos !== 1 ? 's' : ''}
        </p>

        {/* Badges de método + propina — sin color distintivo por método (ni
            azul/verde/esmeralda ni ningún otro): un color por método no
            comunica nada real y compite con el verde bosque como señal de
            "esto es lo activo/importante" (mismo criterio recién aplicado
            en Cobro). Neutro para método, ámbar informativo para propina
            (mismo tono ya usado en la tarjeta de propina de Cobro). */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {r.pagos.length > 1 ? (
            <span className="flex items-center gap-1 rounded-full bg-s2 px-2 py-0.5 text-[11px] font-semibold text-text-2">
              <CirclePlus size={11} strokeWidth={2.2} />
              Mixto
            </span>
          ) : r.pagos.length === 1 ? (
            (() => {
              const info = METODO_INFO[r.pagos[0].metodo]
              return (
                <span className="flex items-center gap-1 rounded-full bg-s2 px-2 py-0.5 text-[11px] font-semibold text-text-2">
                  <info.Icon size={11} strokeWidth={2.2} />
                  {info.label}
                </span>
              )
            })()
          ) : null}
          {r.propinaPct !== null && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {r.propinaPct}% Propina
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-[#173F2E]/10 px-2 py-0.5 text-[11px] font-semibold text-[#173F2E]">
          <Check size={11} strokeWidth={3} />
          Cerrada
        </span>
        <span className="font-mono text-[15px] font-bold text-[#173F2E]">
          {formatCurrency(r.total)}
        </span>
      </div>
      <ChevronRight size={17} strokeWidth={2.2} className="mt-1 flex-shrink-0 text-text-4" />
    </button>
  )
}

// ─── Bottom sheet de detalle ──────────────────────────────────────────────────

function ReciboSheet({
  recibo: r,
  puedeReabrir,
  onClose,
  onReabierto,
}: {
  recibo: ReciboData
  puedeReabrir: boolean
  onClose: () => void
  onReabierto: () => void
}) {
  const [imprimiendo, setImprimiendo] = useState(false)
  const [printError, setPrintError] = useState(false)
  const [confirmandoReabrir, setConfirmandoReabrir] = useState(false)
  const [reabriendo, setReabriendo] = useState(false)
  const [reabrirError, setReabrirError] = useState<string | null>(null)

  useEffect(() => {
    if (!printError) return
    const t = setTimeout(() => setPrintError(false), 4000)
    return () => clearTimeout(t)
  }, [printError])

  useEffect(() => {
    if (!reabrirError) return
    const t = setTimeout(() => setReabrirError(null), 4000)
    return () => clearTimeout(t)
  }, [reabrirError])

  async function handleReimprimir() {
    setImprimiendo(true)
    setPrintError(false)
    try {
      const res = await reimprimirTicketCliente(r.id)
      if (!res.ok) setPrintError(true)
    } catch {
      setPrintError(true)
    } finally {
      setImprimiendo(false)
    }
  }

  async function handleReabrir() {
    if (!r.pedidoId) return
    setReabriendo(true)
    setReabrirError(null)
    try {
      const res = await reabrirPedido(r.pedidoId)
      if (res.ok) {
        onReabierto()
      } else {
        setReabrirError(res.error)
        setConfirmandoReabrir(false)
      }
    } catch {
      setReabrirError('No se pudo reabrir el pedido.')
      setConfirmandoReabrir(false)
    } finally {
      setReabriendo(false)
    }
  }

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
              Recibo #{r.id} · {fmtHora(r.createdAt)} · {r.meseroNombre}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[12px] text-text-3">
              <Users size={12} strokeWidth={2.2} />
              {r.numComensales} comensal{r.numComensales !== 1 ? 'es' : ''}
              <span className="mx-0.5">·</span>
              <Package size={12} strokeWidth={2.2} />
              {r.numProductos} producto{r.numProductos !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="rounded-xl bg-s2 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Total cobrado</p>
            <span className="font-mono text-[20px] font-bold text-[#173F2E]">
              {formatCurrency(r.total)}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-[#E5E5EA] divide-y divide-[#F2F2F7] overflow-hidden">
            {r.pagos.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <p className="flex items-center gap-2 text-sm">
                  {(() => { const Icon = METODO_INFO[p.metodo].Icon; return <Icon size={15} strokeWidth={2.2} className="text-text-3" /> })()}
                  {METODO_INFO[p.metodo].label}
                </p>
                <span className="font-mono text-sm font-semibold">{formatCurrency(p.monto)}</span>
              </div>
            ))}
            {r.efectivoRecibido !== null && r.cambio !== null && r.cambio > 0 && (
              <>
                <div className="flex items-center justify-between px-4 py-3 bg-s2">
                  <p className="text-xs text-text-3">Recibido en efectivo</p>
                  <span className="font-mono text-xs text-text-3">
                    {formatCurrency(r.efectivoRecibido)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-s2">
                  <p className="text-xs text-text-3">Cambio entregado</p>
                  <span className="font-mono text-xs text-text-3">{formatCurrency(r.cambio)}</span>
                </div>
              </>
            )}
          </div>

          {printError && (
            <p className="text-center text-xs font-semibold text-red-600">
              No se pudo conectar con la impresora.
            </p>
          )}

          <Boton variant="secundario" onClick={handleReimprimir} disabled={imprimiendo}>
            <Printer size={16} strokeWidth={2.2} />
            {imprimiendo ? 'Enviando…' : 'Enviar a impresora'}
          </Boton>

          {puedeReabrir && r.pedidoId && (
            <>
              {reabrirError && (
                <p className="text-center text-xs font-semibold text-red-600">{reabrirError}</p>
              )}

              {confirmandoReabrir ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">
                    ¿Reabrir este pedido? Se eliminará el cobro registrado y el pedido volverá a
                    estar abierto.
                  </p>
                  <div className="flex gap-2">
                    <Boton variant="secundario" onClick={() => setConfirmandoReabrir(false)} disabled={reabriendo}>
                      Cancelar
                    </Boton>
                    <Boton variant="peligro" onClick={handleReabrir} disabled={reabriendo}>
                      {reabriendo ? 'Reabriendo…' : 'Sí, reabrir'}
                    </Boton>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmandoReabrir(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-red-300 py-4 text-sm font-semibold text-red-600 active:opacity-70"
                >
                  <RotateCcw size={16} strokeWidth={2.2} />
                  Reabrir pedido
                </button>
              )}
            </>
          )}

          <Boton variant="secundario" onClick={onClose}>
            Cerrar
          </Boton>
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
