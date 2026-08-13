'use client'

import { useEffect, useState, useTransition } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'
import type { ComboSlot } from '@/app/(app)/pos/[pedidoId]/actions'
import type { ProductoCatalogo } from '@/app/(app)/pos/[pedidoId]/page'

export type ConfirmarComboPayload = {
  productoId: number
  precioUnit: number
  cantidad: number
  notas: string | null
  comboSelecciones: { slotId: number; productoId: number }[]
}

interface SheetComboSlotsProps {
  producto: ProductoCatalogo | null
  // Ya viene cargado por PosShell (ver cargarComboSlots) — el pre-check que
  // decide si abrir este sheet o el flujo normal ya hizo el fetch, así que
  // este componente no vuelve a pedirlo.
  slots: ComboSlot[]
  onConfirmar: (payload: ConfirmarComboPayload) => Promise<{ error?: string }>
  onClose: () => void
}

// Combo electivo (F7-04): una opción por slot (ej. "Bebida a elegir") antes
// de agregar el combo a la comanda. Los componentes fijos del combo
// (combo_productos) no se muestran aquí — no son elección de nadie, se
// consumen solos vía aplicar_consumo_receta() igual que siempre.
export function SheetComboSlots({ producto, slots, onConfirmar, onClose }: SheetComboSlotsProps) {
  const open = producto !== null
  const [seleccion, setSeleccion] = useState<Map<number, number>>(new Map())
  const [cantidad, setCantidad] = useState(1)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!producto) return
    setSeleccion(new Map())
    setCantidad(1)
    setNotas('')
    setError(null)
  }, [producto?.id])

  function elegir(slotId: number, productoId: number) {
    setSeleccion((prev) => new Map(prev).set(slotId, productoId))
  }

  const slotsPendientes = slots.filter((s) => s.requerido && !seleccion.has(s.id))
  const valido = slotsPendientes.length === 0

  function handleConfirmar() {
    if (!producto || !valido) return
    setError(null)
    const comboSelecciones = [...seleccion.entries()].map(([slotId, productoId]) => ({
      slotId,
      productoId,
    }))

    startTransition(async () => {
      const result = await onConfirmar({
        productoId: producto.id,
        precioUnit: producto.precio,
        cantidad,
        notas: notas.trim() || null,
        comboSelecciones,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  const total = producto ? producto.precio * cantidad : 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      maxHeightClass="max-h-[92vh]"
      header={
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold leading-tight">{producto?.nombre}</h2>
              <p className="mt-0.5 text-[13px] text-text-3">Elige una opción por sección</p>
            </div>
            {producto && (
              <span className="flex-shrink-0 font-mono text-[17px] font-bold text-green-600">
                ${producto.precio.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      }
      footer={
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="max-w-[60%] truncate text-[13px] text-text-2">{producto?.nombre ?? ''}</p>
            <span className="font-mono text-xl font-bold text-amber-600">${total.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-card border-[1.5px] border-border">
              <button
                onClick={() => setCantidad((n) => Math.max(1, n - 1))}
                className="flex h-[38px] w-[38px] items-center justify-center text-lg text-text-2 active:bg-s2"
              >
                −
              </button>
              <div className="flex h-[38px] w-[40px] items-center justify-center border-x-[1.5px] border-border font-mono text-base font-bold">
                {cantidad}
              </div>
              <button
                onClick={() => setCantidad((n) => n + 1)}
                className="flex h-[38px] w-[38px] items-center justify-center text-lg text-text-2 active:bg-s2"
              >
                +
              </button>
            </div>

            <Boton
              fullWidth={false}
              className="flex-1"
              onClick={handleConfirmar}
              disabled={!valido || isPending}
            >
              {isPending
                ? 'Agregando…'
                : slotsPendientes[0]
                  ? `Elige ${slotsPendientes[0].nombre}`
                  : '✓ Agregar a comanda'}
            </Boton>
          </div>
        </>
      }
    >
      {slots.map((slot) => {
        const elegido = seleccion.get(slot.id)
        const cumplido = !slot.requerido || elegido !== undefined

        return (
          <div key={slot.id}>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-[15px] font-semibold">{slot.nombre}</span>
              {slot.requerido ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    cumplido ? 'bg-[#173F2E]/10 text-[#173F2E]' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {cumplido ? '✓ Listo' : 'Elige 1'}
                </span>
              ) : (
                <span className="rounded-full bg-s2 px-2 py-0.5 text-[11px] font-semibold text-text-3">
                  Opcional
                </span>
              )}
            </div>

            <div className="space-y-2">
              {slot.opciones.map((opcion) => {
                const sel = elegido === opcion.productoId
                return (
                  <button
                    key={opcion.id}
                    onClick={() => elegir(slot.id, opcion.productoId)}
                    className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left transition-all active:scale-[.98] ${
                      sel ? 'border-[#173F2E] bg-[#173F2E]/5' : 'border-border bg-white'
                    }`}
                  >
                    <div
                      className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold text-white transition-all ${
                        sel ? 'border-[#173F2E] bg-[#173F2E]' : 'border-border'
                      }`}
                    >
                      {sel && '✓'}
                    </div>
                    <span className="text-lg">{opcion.emoji ?? '🍽️'}</span>
                    <span className="flex-1 text-sm font-medium">{opcion.nombre}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
          Nota para cocina (opcional)
        </label>
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej: sin cebolla, extra limón…"
          className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
        />
      </div>

      {error && <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
    </Sheet>
  )
}
