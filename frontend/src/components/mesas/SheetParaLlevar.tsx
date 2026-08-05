'use client'

import { useRef, useState, useTransition } from 'react'
import { abrirPedidoLlevar } from '@/app/(app)/mesas/actions'
import { Sheet } from '@/components/ui/Sheet'
import { Boton } from '@/components/ui/Boton'

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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="📦 Pedido para llevar"
      footer={
        <form ref={formRef} id="form-para-llevar" onSubmit={handleSubmit} className="flex gap-2.5">
          <Boton type="button" variant="secundario" fullWidth={false} onClick={onClose} disabled={isPending} className="flex-1">
            Cancelar
          </Boton>
          <Boton type="submit" fullWidth={false} disabled={isPending} className="flex-[2]">
            {isPending ? 'Creando…' : '✓ Crear pedido'}
          </Boton>
        </form>
      }
    >
      <p className="text-[13px] text-text-3">Datos del cliente — todos opcionales</p>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
          Nombre del cliente
        </label>
        <input
          form="form-para-llevar"
          name="nombre"
          type="text"
          placeholder="Ej: Don Carlos (opcional)"
          className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
          Teléfono
        </label>
        <input
          form="form-para-llevar"
          name="telefono"
          type="tel"
          placeholder="(opcional)"
          className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
          Hora de recogida
        </label>
        <input
          form="form-para-llevar"
          name="hora_recogida"
          type="time"
          className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
        />
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs leading-relaxed text-text-2">
        <strong className="text-blue-700">Sin datos:</strong> el pedido aparece como "Para
        llevar" en cocina. Funciona igual.
      </div>

      {error && (
        <p className="rounded-card bg-red-50 px-3.5 py-3 text-sm text-red-600">{error}</p>
      )}
    </Sheet>
  )
}
