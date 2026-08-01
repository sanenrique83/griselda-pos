'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moverPedidoDeMesa } from '@/app/(app)/pos/[pedidoId]/actions'

export type MesaLibre = {
  id: number
  mesaLabel: string
}

interface SheetMoverMesaProps {
  open: boolean
  pedidoId: number
  mesasLibres: MesaLibre[]
  onClose: () => void
}

// F9-01: a diferencia de SheetUnirMesa (fusiona comensales de dos pedidos,
// operación irreversible que sí pide confirmación en dos pasos), mover un
// pedido a otra mesa no combina nada — mismo pedido, nueva ubicación. Un solo
// paso de confirmación es suficiente.
export function SheetMoverMesa({
  open,
  pedidoId,
  mesasLibres,
  onClose,
}: SheetMoverMesaProps) {
  const router = useRouter()
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setSeleccionado(null)
    setError(null)
    onClose()
  }

  function handleMover() {
    if (!seleccionado) return
    setError(null)
    startTransition(async () => {
      const result = await moverPedidoDeMesa(pedidoId, seleccionado)
      if (result?.error) {
        setError(result.error)
        return
      }
      handleClose()
      router.refresh()
    })
  }

  const mesaDestino = mesasLibres.find((m) => m.id === seleccionado)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[80vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />

        {/* Header */}
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Mover a otra mesa</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            El pedido completo se reasigna a la mesa que elijas, sin unir comensales.
          </p>
        </div>

        {/* Lista de mesas libres */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {mesasLibres.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-3">
              No hay mesas libres disponibles.
            </div>
          ) : (
            mesasLibres.map((m) => (
              <button
                key={m.id}
                onClick={() => setSeleccionado(m.id)}
                className={`w-full flex items-center justify-between rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-all active:scale-[.98] ${
                  seleccionado === m.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-[#D1D1D6] bg-white'
                }`}
              >
                <p className="text-sm font-semibold">{m.mesaLabel}</p>
                {seleccionado === m.id && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    ✓
                  </div>
                )}
              </button>
            ))
          )}

          {error && (
            <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Pie */}
        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5 space-y-2">
          {seleccionado && (
            <button
              onClick={handleMover}
              disabled={isPending}
              className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {isPending ? 'Moviendo…' : `Mover a ${mesaDestino?.mesaLabel}`}
            </button>
          )}
          <button
            onClick={handleClose}
            className="w-full rounded-xl bg-s2 py-[14px] text-sm font-semibold text-text-2 active:scale-[.98]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}
