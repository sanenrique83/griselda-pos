'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ItemComandaRow } from './ItemComanda'
import { enviarACocina, agregarComensal, eliminarComensal, cancelarItem, eliminarProductoPendiente, moverProducto, dividirProducto, anularPedidoCompleto, asignarSilla } from '@/app/(app)/pos/[pedidoId]/actions'
import type { SubpedidoPOS, ItemComanda, MesaSillas, MesaCadenaItem } from '@/app/(app)/pos/[pedidoId]/page'
import { imprimirTicket, type TicketConfig } from '@/lib/print'
import { agruparPorGrupo, construirDescripcionNatural, type OpcionConGrupo } from '@/lib/descripcionNatural'
import { SheetAsientos } from './SheetAsientos'
import { siguienteSillaLibre } from '@/lib/asientos'

const MOTIVOS_CANCELACION = [
  'Error de captura',
  'Cliente cambió de opinión',
  'Producto no disponible',
  'Otro',
]

// "Ronda" = una tanda confirmada a cocina — enviar_pedido_a_cocina() estampa
// el mismo enviado_en (NOW() de la transacción) a todos los ítems de un
// mismo envío, así que valores distintos entre los ítems 'enviado' de un
// comensal son, literalmente, envíos distintos. No se basa en categoría
// (comida+bebida en el mismo pedido no cuenta como 2 rondas) ni en gaps de
// tiempo de captura (frágil ante interrupciones del mesero).
function contarRondas(items: ItemComanda[]): number {
  const enviados = new Set(
    items
      .filter((i) => i.estado === 'enviado' && i.enviadoEn)
      .map((i) => i.enviadoEn),
  )
  return enviados.size
}

interface VistaComandaProps {
  pedidoId: number
  subpedidos: SubpedidoPOS[]
  onCambiarSubpedido: (id: number) => void
  onAgregar: () => void // vuelve a vista menú
  puedesCancelar?: boolean
  puedeAnularPedido?: boolean
  mesaId?: number | null
  mesaLabel?: string
  meseroNombre?: string
  rol?: string
  tipoMesa?: 'mesa' | 'llevar' | 'mostrador'
  mesaSillas?: MesaSillas
  mesasCadena?: MesaCadenaItem[] | null
  ticketConfig: TicketConfig
}

// Ítem a mover — se guarda junto con la sección (comensal) de origen, ya
// que en la cascada todos los comensales se ven a la vez y ya no hay una
// "pestaña activa" de la que inferirlo (antes bastaba subpedidoActivoId).
type ItemAMover = { item: ItemComanda; origenSubId: number }

export function VistaComanda({
  pedidoId,
  subpedidos,
  onCambiarSubpedido,
  onAgregar,
  puedesCancelar = false,
  puedeAnularPedido = false,
  mesaId = null,
  mesaLabel = '',
  meseroNombre = 'Mesero',
  rol = 'mesero',
  tipoMesa = 'mesa',
  mesaSillas = null,
  mesasCadena = null,
  ticketConfig,
}: VistaComandaProps) {
  const router = useRouter()
  const [isPendingEnviar, startEnviar] = useTransition()
  const [isPendingComensal, startComensal] = useTransition()
  const [isPendingEliminar, startEliminar] = useTransition()
  const [isPendingCancelar, startCancelar] = useTransition()
  const [isPendingMover, startMover] = useTransition()
  const [isPendingEliminarItem, startEliminarItem] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [printError, setPrintError] = useState(false)
  const [itemACancelar, setItemACancelar] = useState<ItemComanda | null>(null)
  const [motivoIdx, setMotivoIdx] = useState(0)
  const [itemAMover, setItemAMover] = useState<ItemAMover | null>(null)
  const [cantidadMover, setCantidadMover] = useState(1)
  const [isPendingReimprimir, setIsPendingReimprimir] = useState(false)
  const [sheetAnularOpen, setSheetAnularOpen] = useState(false)
  const [motivoAnularIdx, setMotivoAnularIdx] = useState(0)
  const [isPendingAnular, startAnular] = useTransition()
  const [sheetAsientosOpen, setSheetAsientosOpen] = useState(false)

  useEffect(() => {
    if (printError) {
      const t = setTimeout(() => setPrintError(false), 4000)
      return () => clearTimeout(t)
    }
  }, [printError])

  const totalPedido = subpedidos.reduce((s, sp) => s + sp.total, 0)
  const hayPendientes = subpedidos.some((s) =>
    s.items.some((i) => i.estado === 'pendiente'),
  )
  const hayEnviados = subpedidos.some((s) =>
    s.items.some((i) => i.estado === 'enviado'),
  )

  // Formato 'texto_natural' del ticket de cocina: una sola frase en vez del
  // arreglo de modificadores (ver lib/descripcionNatural.ts) — el desglose
  // de combo (F7-04) no es una selección de grupo, así que se queda aparte
  // como modificadores adicionales en vez de meterse en la frase.
  function nombreYModificadores(item: ItemComanda): { nombre: string; modificadores: string[] } {
    if (ticketConfig.formato_modificadores_ticket === 'texto_natural') {
      const conGrupo: OpcionConGrupo[] = item.opciones.map((o) => ({
        nombre: o.nombre,
        grupoId: o.grupoId,
        grupoOrden: o.grupoOrden,
        grupoConector: o.grupoConector,
        grupoPrefijoSeleccionUnica: o.grupoPrefijoSeleccionUnica,
      }))
      return {
        nombre: construirDescripcionNatural(item.nombre, agruparPorGrupo(conGrupo)),
        modificadores: item.comboDesglose ?? [],
      }
    }
    return {
      nombre: item.nombre,
      modificadores: [...item.opciones.map((o) => o.nombre), ...(item.comboDesglose ?? [])],
    }
  }

  function handleEnviar() {
    setError(null)
    startEnviar(async () => {
      const comensales = subpedidos
        .filter((sp) => sp.items.some((i) => i.estado === 'pendiente'))
        .map((sp) => ({
          comensal: sp.nombre || `Comensal ${sp.comensal_numero}`,
          items: sp.items
            .filter((i) => i.estado === 'pendiente')
            .map((i) => ({
              cantidad: i.cantidad,
              // Combo (F7-04): el desglose de componentes fijos + elecciones
              // de slot ya viene resuelto a texto desde el servidor (ver
              // pos/[pedidoId]/page.tsx) — se concatena a los modificadores
              // para que cocina vea todo bajo el mismo nombre de producto.
              ...nombreYModificadores(i),
              nota: i.notas ?? '',
              esBebida: i.esBebida,
            })),
        }))

      const result = await enviarACocina(pedidoId)
      if (result?.error) {
        setError(result.error)
        return
      }

      router.refresh()

      if (comensales.length > 0) {
        const printOk = await imprimirTicket({
          tipo: 'cocina',
          mesa: mesaLabel,
          mesero: meseroNombre,
          orden: String(pedidoId),
          rol,
          tipoMesa,
          comensales,
          config: ticketConfig,
        })
        if (!printOk) setPrintError(true)
      }
    })
  }

  function handleReimprimirCocina() {
    setError(null)
    setIsPendingReimprimir(true)
    ;(async () => {
      const comensales = subpedidos
        .filter((sp) => sp.items.some((i) => i.estado === 'enviado'))
        .map((sp) => ({
          comensal: sp.nombre || `Comensal ${sp.comensal_numero}`,
          items: sp.items
            .filter((i) => i.estado === 'enviado')
            .map((i) => ({
              cantidad: i.cantidad,
              ...nombreYModificadores(i),
              nota: i.notas ?? '',
              esBebida: i.esBebida,
            })),
        }))

      if (comensales.length > 0) {
        const printOk = await imprimirTicket({
          tipo: 'cocina',
          mesa: mesaLabel,
          mesero: meseroNombre,
          orden: String(pedidoId),
          rol,
          tipoMesa,
          comensales,
          reimpresion: true,
          config: ticketConfig,
        })
        if (!printOk) setPrintError(true)
      }
      setIsPendingReimprimir(false)
    })()
  }

  function handleEliminarComensal(subId: number) {
    setError(null)
    startEliminar(async () => {
      const result = await eliminarComensal(pedidoId, subId)
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleCancelarItem() {
    if (!itemACancelar) return
    const motivo = MOTIVOS_CANCELACION[motivoIdx]
    startCancelar(async () => {
      const result = await cancelarItem(itemACancelar.id, motivo)
      if (result?.error) {
        setError(result.error)
      } else {
        setItemACancelar(null)
        setMotivoIdx(0)
        router.refresh()
      }
    })
  }

  function handleEliminarPendiente(itemId: number) {
    setError(null)
    startEliminarItem(async () => {
      const result = await eliminarProductoPendiente(itemId)
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleMover(subpedidoDestinoId: number) {
    if (!itemAMover) return
    setError(null)
    const dividir = cantidadMover < itemAMover.item.cantidad
    startMover(async () => {
      const result = dividir
        ? await dividirProducto(itemAMover.item.id, subpedidoDestinoId, cantidadMover)
        : await moverProducto(itemAMover.item.id, subpedidoDestinoId)
      if (result?.error) {
        setError(result.error)
      } else {
        setItemAMover(null)
        router.refresh()
      }
    })
  }

  function handleMoverANuevoComensal() {
    if (!itemAMover) return
    setError(null)
    const dividir = cantidadMover < itemAMover.item.cantidad
    startMover(async () => {
      const nuevo = await agregarComensal(pedidoId)
      if ('error' in nuevo) {
        setError(nuevo.error)
        return
      }
      if (mesaSillas) {
        await asignarSilla(nuevo.nuevoId, siguienteSillaLibre(subpedidos.map((s) => s.silla_numero)))
      }
      const result = dividir
        ? await dividirProducto(itemAMover.item.id, nuevo.nuevoId, cantidadMover)
        : await moverProducto(itemAMover.item.id, nuevo.nuevoId)
      if (result?.error) {
        setError(result.error)
      } else {
        setItemAMover(null)
        router.refresh()
        onCambiarSubpedido(nuevo.nuevoId)
      }
    })
  }

  function handleAnularPedido() {
    setError(null)
    const motivo = MOTIVOS_CANCELACION[motivoAnularIdx]
    startAnular(async () => {
      const result = await anularPedidoCompleto(pedidoId, mesaId ?? null, motivo)
      if (result?.error) {
        setError(result.error)
        setSheetAnularOpen(false)
      }
      // Sin error: anularPedidoCompleto → anularPedido() ya redirige a /mesas.
    })
  }

  // Silla automática (1, 2, 3… en secuencia, sin picker ni confirmación) —
  // el botón manual "🪑 Sillas" sigue disponible para corregir a mano.
  function handleAgregarComensal() {
    setError(null)
    startComensal(async () => {
      const result = await agregarComensal(pedidoId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      if (mesaSillas) {
        await asignarSilla(result.nuevoId, siguienteSillaLibre(subpedidos.map((s) => s.silla_numero)))
      }
      router.refresh()
      onCambiarSubpedido(result.nuevoId)
    })
  }

  // Botón "+ Agregar" de una sección: activa a ESE comensal como destino y
  // navega a Menú en un solo toque, sin tener que seleccionarlo aparte.
  function handleAgregarASeccion(subId: number) {
    onCambiarSubpedido(subId)
    onAgregar()
  }

  const hayAccionesGlobales = hayEnviados || !!mesaSillas || puedeAnularPedido

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barra de acciones globales del pedido (fuera del scroll de comensales) */}
      {hayAccionesGlobales && (
        <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-[#E5E5EA] bg-white px-2 py-1.5 scrollbar-none">
          {hayEnviados && (
            <button
              onClick={handleReimprimirCocina}
              disabled={isPendingReimprimir}
              title="Reimprimir comanda de cocina"
              className="flex-shrink-0 px-2.5 py-1.5 text-[13px] font-medium text-text-3 active:opacity-60 disabled:opacity-40"
            >
              {isPendingReimprimir ? '…' : '🖨 Reimprimir'}
            </button>
          )}
          {mesaSillas && (
            <button
              onClick={() => setSheetAsientosOpen(true)}
              className="flex-shrink-0 px-2.5 py-1.5 text-[13px] font-medium text-text-3 active:opacity-60"
            >
              🪑 Sillas
            </button>
          )}
          {puedeAnularPedido && (
            <button
              onClick={() => { setMotivoAnularIdx(0); setSheetAnularOpen(true) }}
              className="flex-shrink-0 px-2.5 py-1.5 text-[13px] font-medium text-red-600 active:opacity-60"
            >
              🗑 Anular pedido
            </button>
          )}
        </div>
      )}

      {printError && (
        <div className="flex-shrink-0 bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white">
          ⚠️ Sin conexión a impresora
        </div>
      )}

      {/* Cascada: una sección por comensal, todas visibles en scroll continuo */}
      <div className="flex-1 overflow-y-auto space-y-3 px-3 pt-3 pb-32">
        {subpedidos.map((sub) => {
          const label = sub.nombre ?? `Comensal ${sub.comensal_numero}`
          const vacio = sub.items.length === 0
          const puedeEliminar = vacio && subpedidos.length > 1
          const rondas = contarRondas(sub.items)

          return (
            <div key={sub.id} className="rounded-2xl bg-white shadow-card overflow-hidden">
              {/* Encabezado de la sección */}
              <div className="flex items-center justify-between border-b border-[#F2F2F7] px-3.5 py-2.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-semibold leading-tight">{label}</p>
                  {sub.silla_numero && (
                    <span className="inline-flex items-center rounded-full bg-s3 px-1.5 py-0.5 text-[10px] font-bold leading-none text-text-2">
                      🪑{sub.silla_numero}
                    </span>
                  )}
                  {rondas >= 2 && (
                    <span
                      title={`${rondas} tandas mandadas a cocina`}
                      className="inline-flex items-center rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-purple-600"
                    >
                      🔁 {rondas} rondas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] font-semibold text-text-2">
                    ${sub.total.toFixed(2)}
                  </span>
                  {puedeEliminar && (
                    <button
                      onClick={() => handleEliminarComensal(sub.id)}
                      disabled={isPendingEliminar}
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-600 active:scale-90 disabled:opacity-40"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Ítems de este comensal */}
              <div className="space-y-2 px-3 py-2.5">
                {sub.items.length === 0 ? (
                  <p className="py-1.5 text-center text-xs text-text-4">Sin productos aún.</p>
                ) : (
                  sub.items.map((item) => (
                    <ItemComandaRow
                      key={item.id}
                      item={item}
                      onCancelar={
                        item.estado === 'pendiente'
                          ? () => handleEliminarPendiente(item.id)
                          : puedesCancelar && item.estado === 'enviado'
                            ? () => { setItemACancelar(item); setMotivoIdx(0) }
                            : undefined
                      }
                      onMover={
                        item.estado !== 'cancelado'
                          ? () => { setItemAMover({ item, origenSubId: sub.id }); setCantidadMover(item.cantidad) }
                          : undefined
                      }
                    />
                  ))
                )}
              </div>

              {/* + Agregar de este comensal — activa el destino y va a Menú */}
              <button
                onClick={() => handleAgregarASeccion(sub.id)}
                className="w-full border-t border-[#F2F2F7] py-2.5 text-[13px] font-semibold text-blue-600 active:bg-s2"
              >
                + Agregar
              </button>
            </div>
          )
        })}

        {/* + Nuevo comensal */}
        <button
          onClick={handleAgregarComensal}
          disabled={isPendingComensal}
          className="w-full rounded-2xl border-[1.5px] border-dashed border-border bg-white py-3.5 text-[13px] font-semibold text-blue-600 active:scale-[.98] disabled:opacity-40"
        >
          {isPendingComensal ? 'Agregando…' : '+ Nuevo comensal'}
        </button>

        {error && (
          <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* ── Bottom sheet: Cancelar ítem ─────────────────────────────────── */}
      {itemACancelar && (
        <>
          <div
            className="fixed inset-0 z-[65] bg-black/40"
            onClick={() => setItemACancelar(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] flex flex-col rounded-t-2xl bg-white">
            <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[16px] font-bold leading-snug">
                Cancelar {itemACancelar.emoji ? `${itemACancelar.emoji} ` : ''}{itemACancelar.nombre}
              </p>
              <p className="mt-0.5 text-xs text-text-3">Selecciona el motivo</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {MOTIVOS_CANCELACION.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setMotivoIdx(idx)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
                    motivoIdx === idx
                      ? 'bg-red-50 border-[1.5px] border-red-300'
                      : 'bg-s2 border-[1.5px] border-transparent'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white transition-all ${
                      motivoIdx === idx ? 'border-red-500 bg-red-500' : 'border-border'
                    }`}
                  >
                    {motivoIdx === idx && '✓'}
                  </div>
                  <span className="text-[14px] font-medium">{m}</span>
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 px-4 py-4 border-t border-[#E5E5EA] space-y-2.5">
              <button
                onClick={handleCancelarItem}
                disabled={isPendingCancelar}
                className="w-full rounded-xl bg-red-600 py-[15px] text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,.3)] active:scale-[.98] disabled:opacity-40"
              >
                {isPendingCancelar ? 'Cancelando…' : 'Cancelar ítem'}
              </button>
              <button
                onClick={() => setItemACancelar(null)}
                className="w-full rounded-xl bg-s2 py-[15px] text-[15px] font-semibold text-text-2 active:scale-[.98]"
              >
                No cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom sheet: Mover a otro comensal ─────────────────────────── */}
      {itemAMover && (
        <>
          <div
            className="fixed inset-0 z-[65] bg-black/40"
            onClick={() => setItemAMover(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] flex flex-col rounded-t-2xl bg-white">
            <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[16px] font-bold leading-snug">
                Mover {itemAMover.item.emoji ? `${itemAMover.item.emoji} ` : ''}{itemAMover.item.nombre}
              </p>
              <p className="mt-0.5 text-xs text-text-3">Selecciona el comensal destino</p>

              {itemAMover.item.cantidad > 1 && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-s2 px-3 py-2.5">
                  <span className="text-[13px] font-medium text-text-2">
                    Cuántos mover (de {itemAMover.item.cantidad})
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCantidadMover((c) => Math.max(1, c - 1))}
                      disabled={cantidadMover <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[15px] font-bold text-text-2 shadow-sm active:scale-90 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-mono text-[15px] font-bold">
                      {cantidadMover}
                    </span>
                    <button
                      onClick={() => setCantidadMover((c) => Math.min(itemAMover.item.cantidad, c + 1))}
                      disabled={cantidadMover >= itemAMover.item.cantidad}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[15px] font-bold text-text-2 shadow-sm active:scale-90 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {subpedidos
                .filter((s) => s.id !== itemAMover.origenSubId)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleMover(s.id)}
                    disabled={isPendingMover}
                    className="w-full flex items-center justify-between rounded-xl bg-s2 px-4 py-3.5 text-left active:scale-[.98] disabled:opacity-40"
                  >
                    <span className="text-[14px] font-medium">
                      {s.nombre ?? `Comensal ${s.comensal_numero}`}
                    </span>
                    <span className="font-mono text-xs text-text-3">
                      ${s.total.toFixed(2)}
                    </span>
                  </button>
                ))}
              <button
                onClick={handleMoverANuevoComensal}
                disabled={isPendingMover}
                className="w-full flex items-center gap-2 rounded-xl border-[1.5px] border-dashed border-border px-4 py-3.5 text-left text-blue-600 active:scale-[.98] disabled:opacity-40"
              >
                <span className="text-lg leading-none">+</span>
                <span className="text-[14px] font-semibold">Nuevo comensal</span>
              </button>
            </div>
            <div className="flex-shrink-0 px-4 py-4 border-t border-[#E5E5EA]">
              <button
                onClick={() => setItemAMover(null)}
                disabled={isPendingMover}
                className="w-full rounded-xl bg-s2 py-[15px] text-[15px] font-semibold text-text-2 active:scale-[.98] disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom sheet: Anular pedido completo ────────────────────────── */}
      {sheetAnularOpen && (
        <>
          <div
            className="fixed inset-0 z-[65] bg-black/40"
            onClick={() => !isPendingAnular && setSheetAnularOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] flex flex-col rounded-t-2xl bg-white">
            <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[16px] font-bold leading-snug text-red-600">
                Anular pedido completo
              </p>
              <p className="mt-0.5 text-xs text-text-3">Selecciona el motivo</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {MOTIVOS_CANCELACION.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setMotivoAnularIdx(idx)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
                    motivoAnularIdx === idx
                      ? 'bg-red-50 border-[1.5px] border-red-300'
                      : 'bg-s2 border-[1.5px] border-transparent'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white transition-all ${
                      motivoAnularIdx === idx ? 'border-red-500 bg-red-500' : 'border-border'
                    }`}
                  >
                    {motivoAnularIdx === idx && '✓'}
                  </div>
                  <span className="text-[14px] font-medium">{m}</span>
                </button>
              ))}

              <div className="mt-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                ⚠️ Se cancelarán <strong>todos</strong> los productos de este pedido y se
                cerrará la mesa. Esta acción no se puede deshacer.
              </div>
            </div>
            <div className="flex-shrink-0 px-4 py-4 border-t border-[#E5E5EA] space-y-2.5">
              <button
                onClick={handleAnularPedido}
                disabled={isPendingAnular}
                className="w-full rounded-xl bg-red-600 py-[15px] text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,.3)] active:scale-[.98] disabled:opacity-40"
              >
                {isPendingAnular ? 'Anulando…' : 'Sí, anular pedido completo'}
              </button>
              <button
                onClick={() => setSheetAnularOpen(false)}
                disabled={isPendingAnular}
                className="w-full rounded-xl bg-s2 py-[15px] text-[15px] font-semibold text-text-2 active:scale-[.98] disabled:opacity-40"
              >
                No anular
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Sheet: Asientos ──────────────────────────────────────────────── */}
      <SheetAsientos
        open={sheetAsientosOpen}
        onClose={() => setSheetAsientosOpen(false)}
        subpedidos={subpedidos}
        mesaSillas={mesaSillas}
        mesasCadena={mesasCadena}
      />

      {/* Footer fijo — total del pedido completo (ya no "del comensal activo":
          en la cascada se ve todo a la vez, no hay una pestaña resaltada) */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 border-t border-[#E5E5EA] bg-white px-4 py-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] text-text-3">Total pedido</span>
          <span className="font-mono text-xl font-bold text-green-600">
            ${totalPedido.toFixed(2)}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleEnviar}
            disabled={!hayPendientes || isPendingEnviar}
            className="flex-1 rounded-xl bg-blue-600 py-[13px] text-sm font-semibold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.97] disabled:opacity-40"
          >
            {isPendingEnviar ? '…' : '📮 Enviar'}
          </button>
          <button
            onClick={() => router.push(`/cobro/${pedidoId}`)}
            className="flex-1 rounded-xl bg-green-600 py-[13px] text-sm font-semibold text-white shadow-[0_3px_10px_rgba(22,163,74,.28)] active:scale-[.97]"
          >
            💳 Cobrar
          </button>
        </div>
      </div>
    </div>
  )
}
