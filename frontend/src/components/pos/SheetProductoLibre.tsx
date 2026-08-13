'use client'

import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'

interface SheetProductoLibreProps {
  open: boolean
  onConfirmar: (data: { nombre: string; precio: number }) => Promise<{ error?: string }>
  onClose: () => void
}

export function SheetProductoLibre({ open, onConfirmar, onClose }: SheetProductoLibreProps) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  function reset() {
    setNombre('')
    setPrecio('')
    setError(null)
    setIsPending(false)
  }

  async function handleConfirmar() {
    const nombreLimpio = nombre.trim()
    const precioNum = parseFloat(precio)
    if (!nombreLimpio) { setError('Escribe qué es.'); return }
    if (!precioNum || precioNum <= 0) { setError('Escribe un precio válido.'); return }

    setIsPending(true)
    setError(null)
    const result = await onConfirmar({ nombre: nombreLimpio, precio: precioNum })
    setIsPending(false)
    if (result.error) { setError(result.error); return }
    reset()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={() => { reset(); onClose() }}
      header={
        <div className="flex-shrink-0 px-5 pt-1 pb-2">
          <p className="text-[16px] font-bold">✏️ Producto libre</p>
          <p className="text-[12px] text-text-3">
            Para algo que el cliente pidió y no está en el menú. Se agrega solo a esta
            comanda — no se guarda en el catálogo.
          </p>
        </div>
      }
      footer={
        <div className="space-y-2">
          <Boton onClick={handleConfirmar} disabled={isPending}>
            {isPending ? 'Agregando…' : 'Agregar a la comanda'}
          </Boton>
          <Boton variant="secundario" onClick={() => { reset(); onClose() }}>
            Cancelar
          </Boton>
        </div>
      }
    >
      <input
        type="text"
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="¿Qué es? (ej. Extra chorizo)"
        className="w-full rounded-xl border-[1.5px] border-border bg-white px-3.5 py-3 text-[15px] outline-none focus:border-[#173F2E]"
      />

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[14px] text-text-3">
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.50"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-xl border-[1.5px] border-border bg-white py-3 pl-7 pr-3.5 font-mono text-[15px] outline-none focus:border-[#173F2E]"
        />
      </div>

      {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
    </Sheet>
  )
}
