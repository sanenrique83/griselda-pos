'use client'

import { useState } from 'react'

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

  if (!open) return null

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
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/40"
        onClick={() => { reset(); onClose() }}
      />
      <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-white pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-[5px] w-10 rounded-full bg-[#C7C7CC]" />
        </div>
        <div className="px-5 pb-6 space-y-3">
          <div>
            <p className="text-[16px] font-bold">✏️ Producto libre</p>
            <p className="text-[12px] text-text-3">
              Para algo que el cliente pidió y no está en el menú. Se agrega solo a esta
              comanda — no se guarda en el catálogo.
            </p>
          </div>

          <input
            type="text"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="¿Qué es? (ej. Extra chorizo)"
            className="w-full rounded-xl border-[1.5px] border-border bg-white px-3.5 py-3 text-[15px] outline-none focus:border-blue-500"
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
              className="w-full rounded-xl border-[1.5px] border-border bg-white py-3 pl-7 pr-3.5 font-mono text-[15px] outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="text-[12px] font-medium text-red-600">{error}</p>
          )}

          <button
            onClick={handleConfirmar}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"
          >
            {isPending ? 'Agregando…' : 'Agregar a la comanda'}
          </button>
          <button
            onClick={() => { reset(); onClose() }}
            className="w-full rounded-xl bg-s2 py-3.5 text-sm font-semibold text-text-2 active:opacity-70"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}
