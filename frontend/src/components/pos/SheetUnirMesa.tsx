'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'
import { unirMesas } from '@/app/(app)/pos/[pedidoId]/actions'

export type MesaOcupada = {
  pedidoId: number
  mesaLabel: string
  numComensales: number
}

interface SheetUnirMesaProps {
  open: boolean
  pedidoOrigenId: number
  mesasOcupadas: MesaOcupada[]
  onClose: () => void
}

export function SheetUnirMesa({
  open,
  pedidoOrigenId,
  mesasOcupadas,
  onClose,
}: SheetUnirMesaProps) {
  const router = useRouter()
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setSeleccionado(null)
    setConfirmando(false)
    setError(null)
    onClose()
  }

  function handleUnir() {
    if (!seleccionado) return
    setError(null)
    startTransition(async () => {
      const result = await unirMesas(pedidoOrigenId, seleccionado)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push(`/pos/${seleccionado}`)
      }
    })
  }

  const mesaDestino = mesasOcupadas.find((m) => m.pedidoId === seleccionado)

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      maxHeightClass="max-h-[80vh]"
      header={
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Unir con otra mesa</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            Los comensales de esta mesa se moverán a la mesa seleccionada.
          </p>
        </div>
      }
      footer={
        <div className="space-y-2">
          {seleccionado && !confirmando && (
            <Boton onClick={() => setConfirmando(true)}>Unir con {mesaDestino?.mesaLabel}</Boton>
          )}

          {seleccionado && confirmando && (
            <div className="space-y-2">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                Los comensales de esta mesa se moverán a {mesaDestino?.mesaLabel}. Esta operación no se puede deshacer.
              </div>
              <Boton variant="peligro" onClick={handleUnir} disabled={isPending}>
                {isPending ? 'Uniendo…' : 'Confirmar unión'}
              </Boton>
              <Boton variant="secundario" onClick={() => setConfirmando(false)}>
                Cancelar
              </Boton>
            </div>
          )}

          {!seleccionado && (
            <Boton variant="secundario" onClick={handleClose}>
              Cancelar
            </Boton>
          )}
        </div>
      }
    >
      {mesasOcupadas.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-3">
          No hay otras mesas ocupadas disponibles.
        </div>
      ) : (
        mesasOcupadas.map((m) => (
          <button
            key={m.pedidoId}
            onClick={() => {
              setSeleccionado(m.pedidoId)
              setConfirmando(false)
            }}
            className={`w-full flex items-center justify-between rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-all active:scale-[.98] ${
              seleccionado === m.pedidoId
                ? 'border-[#173F2E] bg-[#173F2E]/5'
                : 'border-border bg-white'
            }`}
          >
            <div>
              <p className="text-sm font-semibold">{m.mesaLabel}</p>
              <p className="text-xs text-text-3 mt-0.5">
                {m.numComensales} comensal{m.numComensales !== 1 ? 'es' : ''}
              </p>
            </div>
            {seleccionado === m.pedidoId && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#173F2E] text-[10px] font-bold text-white">
                ✓
              </div>
            )}
          </button>
        ))
      )}

      {error && (
        <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
    </Sheet>
  )
}
