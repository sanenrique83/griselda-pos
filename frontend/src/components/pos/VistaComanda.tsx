'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ItemComandaRow } from './ItemComanda'
import { enviarACocina, agregarComensal, eliminarComensal } from '@/app/(app)/pos/[pedidoId]/actions'
import type { SubpedidoPOS } from '@/app/(app)/pos/[pedidoId]/page'

interface VistaComandaProps {
  pedidoId: number
  subpedidos: SubpedidoPOS[]
  subpedidoActivoId: number
  onCambiarSubpedido: (id: number) => void
  onAgregar: () => void // vuelve a vista menú
}

export function VistaComanda({
  pedidoId,
  subpedidos,
  subpedidoActivoId,
  onCambiarSubpedido,
  onAgregar,
}: VistaComandaProps) {
  const router = useRouter()
  const [isPendingEnviar, startEnviar] = useTransition()
  const [isPendingComensal, startComensal] = useTransition()
  const [isPendingEliminar, startEliminar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const subActivo = subpedidos.find((s) => s.id === subpedidoActivoId)
  const hayPendientes = subpedidos.some((s) =>
    s.items.some((i) => i.estado === 'pendiente'),
  )

  function handleEnviar() {
    setError(null)
    startEnviar(async () => {
      const result = await enviarACocina(pedidoId)
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleEliminarComensal(subId: number) {
    setError(null)
    // Cambiar al primer comensal antes de eliminar
    const otro = subpedidos.find((s) => s.id !== subId)
    if (otro) onCambiarSubpedido(otro.id)
    startEliminar(async () => {
      const result = await eliminarComensal(pedidoId, subId)
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleAgregarComensal() {
    setError(null)
    startComensal(async () => {
      const result = await agregarComensal(pedidoId)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
        onCambiarSubpedido(result.nuevoId)
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tabs de comensales */}
      <div className="flex overflow-x-auto border-b border-[#E5E5EA] bg-white scrollbar-none">
        {subpedidos.map((sub) => {
          const label = sub.nombre ?? `Comensal ${sub.comensal_numero}`
          const activo = sub.id === subpedidoActivoId
          const tienePendientes = sub.items.some((i) => i.estado === 'pendiente')
          const vacio = sub.items.length === 0
          const puedeEliminar = vacio && subpedidos.length > 1

          return (
            <div key={sub.id} className="relative flex-shrink-0 flex items-center">
              <button
                onClick={() => onCambiarSubpedido(sub.id)}
                className={`relative border-b-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  puedeEliminar ? 'pr-6' : ''
                } ${
                  activo
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-text-3'
                }`}
              >
                {label}
                {tienePendientes && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
                )}
              </button>
              {puedeEliminar && (
                <button
                  onClick={() => handleEliminarComensal(sub.id)}
                  disabled={isPendingEliminar}
                  className="absolute right-0 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600 active:scale-90 disabled:opacity-40"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        {/* + Agregar comensal */}
        <button
          onClick={handleAgregarComensal}
          disabled={isPendingComensal}
          className="flex-shrink-0 px-3 py-2.5 text-lg text-blue-600 disabled:opacity-40"
        >
          {isPendingComensal ? '…' : '+'}
        </button>
      </div>

      {/* Lista de items */}
      <div className="flex-1 overflow-y-auto space-y-2 px-3 pt-2 pb-32">
        {!subActivo || subActivo.items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-text-3">Sin productos aún.</p>
            <button
              onClick={onAgregar}
              className="mt-3 text-sm font-semibold text-blue-600"
            >
              + Agregar del menú
            </button>
          </div>
        ) : (
          subActivo.items.map((item) => (
            <ItemComandaRow key={item.id} item={item} />
          ))
        )}

        {error && (
          <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* Footer fijo */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 border-t border-[#E5E5EA] bg-white px-4 py-3.5">
        {/* Total del comensal activo */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] text-text-3">
            Total {subActivo?.nombre ?? `Comensal ${subActivo?.comensal_numero ?? ''}`}
          </span>
          <span className="font-mono text-xl font-bold text-green-600">
            ${(subActivo?.total ?? 0).toFixed(2)}
          </span>
        </div>

        {/* 3 botones */}
        <div className="flex gap-2">
          <button
            onClick={onAgregar}
            className="flex-1 rounded-xl bg-s2 py-[13px] text-sm font-semibold text-text-3 active:scale-[.97]"
          >
            + Agregar
          </button>
          <button
            onClick={handleEnviar}
            disabled={!hayPendientes || isPendingEnviar}
            className="flex-1 rounded-xl bg-blue-600 py-[13px] text-sm font-semibold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.97] disabled:opacity-40"
          >
            {isPendingEnviar ? '…' : '📮 Enviar'}
          </button>
          <button
            onClick={() => router.push(`/cobro/${pedidoId}`)}
            className="flex-1 rounded-xl bg-green-600 py-[13px] text-sm font-semibold text-white shadow-[0_3px_10px_rgba(22,163,74,.28)] active:scale-[.97]"
          >
            💳 Cobrar
          </button>
        </div>
      </div>
    </div>
  )
}
