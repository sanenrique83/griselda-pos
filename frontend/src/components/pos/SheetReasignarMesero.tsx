'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reasignarMesero } from '@/app/(app)/pos/[pedidoId]/actions'

export type MeseroActivo = {
  id: string
  nombre: string
}

interface SheetReasignarMeseroProps {
  open: boolean
  pedidoId: number
  meseroActualId?: string
  meseros: MeseroActivo[]
  onClose: () => void
}

// Reasigna quién atiende el pedido (cambio de turno a media mesa, error al
// abrirla) — admin-only. Solo toca pedidos.mesero_id: el mesero de cada
// subpedido queda como estaba, es trazabilidad de quién agregó a cada
// comensal, no "dueño actual" del pedido (ver comentario en la action).
export function SheetReasignarMesero({
  open,
  pedidoId,
  meseroActualId,
  meseros,
  onClose,
}: SheetReasignarMeseroProps) {
  const router = useRouter()
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setSeleccionado(null)
    setError(null)
    onClose()
  }

  function handleReasignar() {
    if (!seleccionado) return
    setError(null)
    startTransition(async () => {
      const result = await reasignarMesero(pedidoId, seleccionado)
      if ('error' in result) {
        setError(result.error)
        return
      }
      handleClose()
      router.refresh()
    })
  }

  const meseroElegido = meseros.find((m) => m.id === seleccionado)

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
          <h2 className="text-[17px] font-bold">Reasignar mesero</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            Cambia quién atiende este pedido. No afecta el registro de quién agregó a cada
            comensal.
          </p>
        </div>

        {/* Lista de meseros activos */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {meseros.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-3">
              No hay usuarios activos disponibles.
            </div>
          ) : (
            meseros.map((m) => (
              <button
                key={m.id}
                onClick={() => setSeleccionado(m.id)}
                className={`w-full flex items-center justify-between rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-all active:scale-[.98] ${
                  seleccionado === m.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-[#D1D1D6] bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{m.nombre}</p>
                  {m.id === meseroActualId && (
                    <span className="rounded-full bg-s2 px-2 py-0.5 text-[10px] font-semibold text-text-3">
                      Actual
                    </span>
                  )}
                </div>
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
              onClick={handleReasignar}
              disabled={isPending || seleccionado === meseroActualId}
              className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {isPending ? 'Reasignando…' : `Reasignar a ${meseroElegido?.nombre}`}
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
