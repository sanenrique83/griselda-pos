'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'
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
    <Sheet
      open={open}
      onClose={handleClose}
      maxHeightClass="max-h-[80vh]"
      header={
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Mover a otra mesa</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            El pedido completo se reasigna a la mesa que elijas, sin unir comensales.
          </p>
        </div>
      }
      footer={
        <div className="space-y-2">
          {seleccionado && (
            <Boton onClick={handleMover} disabled={isPending}>
              {isPending ? 'Moviendo…' : `Mover a ${mesaDestino?.mesaLabel}`}
            </Boton>
          )}
          <Boton variant="secundario" onClick={handleClose}>
            Cancelar
          </Boton>
        </div>
      }
    >
      {mesasLibres.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-3">No hay mesas libres disponibles.</div>
      ) : (
        mesasLibres.map((m) => (
          <button
            key={m.id}
            onClick={() => setSeleccionado(m.id)}
            className={`w-full flex items-center justify-between rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-all active:scale-[.98] ${
              seleccionado === m.id ? 'border-[#173F2E] bg-[#173F2E]/5' : 'border-border bg-white'
            }`}
          >
            <p className="text-sm font-semibold">{m.mesaLabel}</p>
            {seleccionado === m.id && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#173F2E] text-[10px] font-bold text-white">
                ✓
              </div>
            )}
          </button>
        ))
      )}

      {error && <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
    </Sheet>
  )
}
