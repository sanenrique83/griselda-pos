'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { crearMesaExtra } from '@/app/(app)/mesas/actions'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'

interface SheetMesaExtraProps {
  open: boolean
  onClose: () => void
  areaId: number | null
}

// Crea una mesa temporal ad-hoc con solo la capacidad como dato — forma y
// tamaño quedan en su default y se ajustan después desde /mas/mapa-mesas,
// igual que cualquier mesa recién creada desde el catálogo. Al confirmar
// navega directo a /pos/nueva/[mesaId] (mismo flujo que tocar cualquier
// mesa libre): el mesero elige silla inicial y abre el pedido de una vez.
//
// `areaId` es el área que se está viendo en /mesas al momento de abrir este
// sheet (ver MesasShell.tsx) — la mesa se crea ahí, no siempre en "Sin
// área", para que aparezca junto a las demás mesas de esa misma área.
export function SheetMesaExtra({ open, onClose, areaId }: SheetMesaExtraProps) {
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
      const result = await crearMesaExtra(num, areaId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      onClose()
      router.push(`/pos/nueva/${result.mesaId}`)
    })
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Mesa extra"
      footer={
        <div className="space-y-2">
          <Boton onClick={handleCrear} disabled={isPending}>
            {isPending ? 'Creando…' : 'Crear mesa'}
          </Boton>
          <Boton variant="secundario" onClick={handleClose}>
            Cancelar
          </Boton>
        </div>
      }
    >
      <p className="text-[13px] text-text-3">
        Para grupos que no caben en las mesas normales — se puede acomodar en el mapa después
        desde Más → Mapa de mesas.
      </p>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Capacidad</p>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={capacidad}
        onChange={(e) => setCapacidad(e.target.value)}
        className="w-full rounded-xl border-[1.5px] border-[#D1D1D6] px-4 py-3 text-[16px] font-semibold"
      />

      {error && <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
    </Sheet>
  )
}
