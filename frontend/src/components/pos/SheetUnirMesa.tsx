'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
          <h2 className="text-[17px] font-bold">Unir con otra mesa</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            Los comensales de esta mesa se moverán a la mesa seleccionada.
          </p>
        </div>

        {/* Lista de mesas ocupadas */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
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
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-[#D1D1D6] bg-white'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{m.mesaLabel}</p>
                  <p className="text-xs text-text-3 mt-0.5">
                    {m.numComensales} comensal{m.numComensales !== 1 ? 'es' : ''}
                  </p>
                </div>
                {seleccionado === m.pedidoId && (
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
          {seleccionado && !confirmando && (
            <button
              onClick={() => setConfirmando(true)}
              className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98]"
            >
              Unir con {mesaDestino?.mesaLabel}
            </button>
          )}

          {seleccionado && confirmando && (
            <div className="space-y-2">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                Los comensales de esta mesa se moverán a {mesaDestino?.mesaLabel}. Esta operación no se puede deshacer.
              </div>
              <button
                onClick={handleUnir}
                disabled={isPending}
                className="w-full rounded-xl bg-red-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(220,38,38,.28)] active:scale-[.98] disabled:opacity-40"
              >
                {isPending ? 'Uniendo…' : 'Confirmar unión'}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="w-full rounded-xl bg-s2 py-[14px] text-sm font-semibold text-text-2 active:scale-[.98]"
              >
                Cancelar
              </button>
            </div>
          )}

          {!seleccionado && (
            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-s2 py-[14px] text-sm font-semibold text-text-2 active:scale-[.98]"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </>
  )
}
