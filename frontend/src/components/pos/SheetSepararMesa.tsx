'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'
import { separarMesaUnida } from '@/app/(app)/pos/[pedidoId]/actions'

export type MesaSatelite = {
  id: number
  mesaLabel: string
}

interface SheetSepararMesaProps {
  open: boolean
  pedidoId: number
  mesasSatelite: MesaSatelite[]
  onClose: () => void
}

// F9-02: deshace parcialmente una unión — una mesa satélite vuelve a estar
// libre, sin tocar el resto del pedido ni sus ítems (no reparte nada, a
// diferencia de "Unir"). Mismo patrón de un solo paso que SheetMoverMesa:
// no hay comensales que fusionar, así que no hace falta el doble
// confirm que sí usa SheetUnirMesa.
export function SheetSepararMesa({
  open,
  pedidoId,
  mesasSatelite,
  onClose,
}: SheetSepararMesaProps) {
  const router = useRouter()
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setSeleccionado(null)
    setError(null)
    onClose()
  }

  function handleSeparar() {
    if (!seleccionado) return
    setError(null)
    startTransition(async () => {
      const result = await separarMesaUnida(pedidoId, seleccionado)
      if (result?.error) {
        setError(result.error)
        return
      }
      handleClose()
      router.refresh()
    })
  }

  const mesaElegida = mesasSatelite.find((m) => m.id === seleccionado)

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      maxHeightClass="max-h-[80vh]"
      header={
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Separar mesa</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            La mesa elegida vuelve a estar libre. Los productos ya capturados se quedan en este
            pedido, sin repartir nada.
          </p>
        </div>
      }
      footer={
        <div className="space-y-2">
          {seleccionado && (
            <Boton onClick={handleSeparar} disabled={isPending}>
              {isPending ? 'Separando…' : `Separar ${mesaElegida?.mesaLabel}`}
            </Boton>
          )}
          <Boton variant="secundario" onClick={handleClose}>
            Cancelar
          </Boton>
        </div>
      }
    >
      {mesasSatelite.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-3">Este pedido no tiene mesas unidas.</div>
      ) : (
        mesasSatelite.map((m) => (
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
