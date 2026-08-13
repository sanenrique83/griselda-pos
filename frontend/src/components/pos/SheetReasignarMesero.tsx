'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'
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
    <Sheet
      open={open}
      onClose={handleClose}
      maxHeightClass="max-h-[80vh]"
      header={
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Reasignar mesero</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            Cambia quién atiende este pedido. No afecta el registro de quién agregó a cada
            comensal.
          </p>
        </div>
      }
      footer={
        <div className="space-y-2">
          {seleccionado && (
            <Boton onClick={handleReasignar} disabled={isPending || seleccionado === meseroActualId}>
              {isPending ? 'Reasignando…' : `Reasignar a ${meseroElegido?.nombre}`}
            </Boton>
          )}
          <Boton variant="secundario" onClick={handleClose}>
            Cancelar
          </Boton>
        </div>
      }
    >
      {meseros.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-3">No hay usuarios activos disponibles.</div>
      ) : (
        meseros.map((m) => (
          <button
            key={m.id}
            onClick={() => setSeleccionado(m.id)}
            className={`w-full flex items-center justify-between rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-all active:scale-[.98] ${
              seleccionado === m.id ? 'border-[#173F2E] bg-[#173F2E]/5' : 'border-border bg-white'
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
