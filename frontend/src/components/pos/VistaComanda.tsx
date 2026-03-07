'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ItemComandaRow } from './ItemComanda'
import { enviarACocina, agregarComensal, eliminarComensal, cancelarItem } from '@/app/(app)/pos/[pedidoId]/actions'
import type { SubpedidoPOS, ItemComanda } from '@/app/(app)/pos/[pedidoId]/page'
import { imprimirTicket } from '@/lib/print'

const MOTIVOS_CANCELACION = [
  'Error de captura',
  'Cliente cambió de opinión',
  'Producto no disponible',
  'Otro',
]

interface VistaComandaProps {
  pedidoId: number
  subpedidos: SubpedidoPOS[]
  subpedidoActivoId: number
  onCambiarSubpedido: (id: number) => void
  onAgregar: () => void // vuelve a vista menú
  puedesCancelar?: boolean
  mesaLabel?: string
  meseroNombre?: string
  rol?: string
  tipoMesa?: 'mesa' | 'llevar'
}

export function VistaComanda({
  pedidoId,
  subpedidos,
  subpedidoActivoId,
  onCambiarSubpedido,
  onAgregar,
  puedesCancelar = false,
  mesaLabel = '',
  meseroNombre = 'Mesero',
  rol = 'mesero',
  tipoMesa = 'mesa',
}: VistaComandaProps) {
  const router = useRouter()
  const [isPendingEnviar, startEnviar] = useTransition()
  const [isPendingComensal, startComensal] = useTransition()
  const [isPendingEliminar, startEliminar] = useTransition()
  const [isPendingCancelar, startCancelar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [printError, setPrintError] = useState(false)
  const [itemACancelar, setItemACancelar] = useState<ItemComanda | null>(null)
  const [motivoIdx, setMotivoIdx] = useState(0)

  useEffect(() => {
    if (printError) {
      const t = setTimeout(() => setPrintError(false), 4000)
      return () => clearTimeout(t)
    }
  }, [printError])

  const subActivo = subpedidos.find((s) => s.id === subpedidoActivoId)
  const hayPendientes = subpedidos.some((s) =>
    s.items.some((i) => i.estado === 'pendiente'),
  )

  function handleEnviar() {
    setError(null)
    startEnviar(async () => {
      const comensales = subpedidos
        .filter((sp) => sp.items.some((i) => i.estado === 'pendiente'))
        .map((sp) => ({
          comensal: sp.nombre || `Comensal ${sp.comensal_numero}`,
          items: sp.items
            .filter((i) => i.estado === 'pendiente')
            .map((i) => ({
              cantidad: i.cantidad,
              nombre: i.nombre,
              modificadores: i.opciones.map((o) => o.nombre),
              nota: i.notas ?? '',
              esBebida: i.esBebida,
            })),
        }))

      const result = await enviarACocina(pedidoId)
      if (result?.error) {
        setError(result.error)
        return
      }

      router.refresh()

      if (comensales.length > 0) {
        const printOk = await imprimirTicket({
          tipo: 'cocina',
          mesa: mesaLabel,
          mesero: meseroNombre,
          orden: String(pedidoId),
          rol,
          tipoMesa,
          comensales,
        })
        if (!printOk) setPrintError(true)
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

  function handleCancelarItem() {
    if (!itemACancelar) return
    const motivo = MOTIVOS_CANCELACION[motivoIdx]
    startCancelar(async () => {
      const result = await cancelarItem(itemACancelar.id, motivo)
      if (result?.error) {
        setError(result.error)
      } else {
        setItemACancelar(null)
        setMotivoIdx(0)
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

      {printError && (
        <div className="flex-shrink-0 bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white">
          ⚠️ Sin conexión a impresora
        </div>
      )}

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
            <ItemComandaRow
              key={item.id}
              item={item}
              onCancelar={
                puedesCancelar && item.estado === 'enviado'
                  ? () => { setItemACancelar(item); setMotivoIdx(0) }
                  : undefined
              }
            />
          ))
        )}

        {error && (
          <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* ── Bottom sheet: Cancelar ítem ─────────────────────────────────── */}
      {itemACancelar && (
        <>
          <div
            className="fixed inset-0 z-[65] bg-black/40"
            onClick={() => setItemACancelar(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] flex flex-col rounded-t-2xl bg-white">
            <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#E5E5EA]">
              <p className="text-[16px] font-bold leading-snug">
                Cancelar {itemACancelar.emoji ? `${itemACancelar.emoji} ` : ''}{itemACancelar.nombre}
              </p>
              <p className="mt-0.5 text-xs text-text-3">Selecciona el motivo</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {MOTIVOS_CANCELACION.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setMotivoIdx(idx)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
                    motivoIdx === idx
                      ? 'bg-red-50 border-[1.5px] border-red-300'
                      : 'bg-s2 border-[1.5px] border-transparent'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white transition-all ${
                      motivoIdx === idx ? 'border-red-500 bg-red-500' : 'border-border'
                    }`}
                  >
                    {motivoIdx === idx && '✓'}
                  </div>
                  <span className="text-[14px] font-medium">{m}</span>
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 px-4 py-4 border-t border-[#E5E5EA] space-y-2.5">
              <button
                onClick={handleCancelarItem}
                disabled={isPendingCancelar}
                className="w-full rounded-xl bg-red-600 py-[15px] text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,.3)] active:scale-[.98] disabled:opacity-40"
              >
                {isPendingCancelar ? 'Cancelando…' : 'Cancelar ítem'}
              </button>
              <button
                onClick={() => setItemACancelar(null)}
                className="w-full rounded-xl bg-s2 py-[15px] text-[15px] font-semibold text-text-2 active:scale-[.98]"
              >
                No cancelar
              </button>
            </div>
          </div>
        </>
      )}

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
