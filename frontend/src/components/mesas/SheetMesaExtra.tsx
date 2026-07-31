'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { crearMesaExtra } from '@/app/(app)/mesas/actions'

interface SheetMesaExtraProps {
  open: boolean
  onClose: () => void
}

// Crea una mesa temporal ad-hoc con solo la capacidad como dato — forma y
// tamaño quedan en su default y se ajustan después desde /mas/mapa-mesas,
// igual que cualquier mesa recién creada desde el catálogo. Al confirmar
// navega directo a /pos/nueva/[mesaId] (mismo flujo que tocar cualquier
// mesa libre): el mesero elige silla inicial y abre el pedido de una vez.
export function SheetMesaExtra({ open, onClose }: SheetMesaExtraProps) {
  const router = useRouter()
  const [capacidad, setCapacidad] = useState('4')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setError(null)
    onClose()
  }

  function handleCrear() {
    const num = parseInt(capacidad, 10)
    if (isNaN(num) || num < 1) {
      setError('Ingresa una capacidad válida.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await crearMesaExtra(num)
      if ('error' in result) {
        setError(result.error)
        return
      }
      onClose()
      router.push(`/pos/nueva/${result.mesaId}`)
    })
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={handleClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />

        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Mesa extra</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            Para grupos que no caben en las mesas normales — se puede acomodar
            en el mapa después desde Más → Mapa de mesas.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Capacidad
          </p>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={capacidad}
            onChange={(e) => setCapacidad(e.target.value)}
            className="w-full rounded-xl border-[1.5px] border-[#D1D1D6] px-4 py-3 text-[16px] font-semibold"
          />

          {error && (
            <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5 space-y-2">
          <button
            onClick={handleCrear}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Creando…' : 'Crear mesa'}
          </button>
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
