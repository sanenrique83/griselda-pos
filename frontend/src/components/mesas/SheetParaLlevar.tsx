'use client'

import { useRef, useState, useTransition } from 'react'
import { abrirPedidoLlevar } from '@/app/(app)/mesas/actions'

interface SheetParaLlevarProps {
  open: boolean
  onClose: () => void
}

export function SheetParaLlevar({ open, onClose }: SheetParaLlevarProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await abrirPedidoLlevar(formData)
      if (result?.error) setError(result.error)
    })
  }

  // Backdrop + sheet. La animación es solo CSS: translate-y-full → translate-y-0
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] max-h-[88vh] overflow-y-auto rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-s3" />

        {/* Header */}
        <div className="border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">📦 Pedido para llevar</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            Datos del cliente — todos opcionales
          </p>
        </div>

        {/* Campos */}
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-3 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Nombre del cliente
              </label>
              <input
                name="nombre"
                type="text"
                placeholder="Ej: Don Carlos (opcional)"
                className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Teléfono
              </label>
              <input
                name="telefono"
                type="tel"
                placeholder="(opcional)"
                className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Hora de recogida
              </label>
              <input
                name="hora_recogida"
                type="time"
                className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs leading-relaxed text-text-2">
              <strong className="text-blue-700">Sin datos:</strong> el pedido aparece
              como "Para llevar" en cocina. Funciona igual.
            </div>

            {error && (
              <p className="rounded-card bg-red-50 px-3.5 py-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          {/* Botones fijos al pie con safe area */}
          <div className="flex gap-2.5 border-t border-[#E5E5EA] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl bg-s2 py-[18px] text-sm font-semibold text-text-3 active:scale-[.98] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-[2] rounded-xl bg-blue-600 py-[18px] text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-50"
            >
              {isPending ? 'Creando…' : '✓ Crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
