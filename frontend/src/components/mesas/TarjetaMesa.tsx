'use client'

import { useEffect, useState } from 'react'
import type { MesaUI } from '@/app/(app)/mesas/page'

interface TarjetaMesaProps {
  mesa: MesaUI
  onClick: () => void
  isPending: boolean
}

export function TarjetaMesa({ mesa, onClick, isPending }: TarjetaMesaProps) {
  const ocupada = mesa.pedido_activo !== null

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`
        relative w-full rounded-xl p-3.5 text-left shadow-card transition-transform
        active:scale-[.97] disabled:opacity-60
        ${ocupada
          ? 'border-[1.5px] border-[#FDE68A] bg-[#FFFDF0]'
          : 'border-[1.5px] border-[#E5E5EA] bg-white'
        }
      `}
    >
      {/* Spinner mientras se crea el pedido */}
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Número de mesa */}
      <div className="text-xl font-bold leading-none">
        {mesa.nombre ?? `Mesa ${mesa.numero}`}
      </div>

      {/* Capacidad */}
      {mesa.capacidad && (
        <div className="mt-0.5 text-xs text-text-4">
          {mesa.capacidad} persona{mesa.capacidad !== 1 ? 's' : ''}
        </div>
      )}

      {/* Badge de estado */}
      <div className="mt-2">
        {ocupada ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
            ● Ocupada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-600">
            ○ Libre
          </span>
        )}
      </div>

      {/* Info del pedido activo */}
      {mesa.pedido_activo && (
        <>
          <div className="mt-1 text-[11px] text-text-3">
            {mesa.pedido_activo.mesero_nombre} · {mesa.pedido_activo.num_comensales} com.
          </div>
          <TiempoTranscurrido desde={mesa.pedido_activo.created_at} />
        </>
      )}
    </button>
  )
}

// Timer que actualiza cada minuto
function TiempoTranscurrido({ desde }: { desde: string }) {
  const [texto, setTexto] = useState(() => formatearTiempo(desde))

  useEffect(() => {
    const id = setInterval(() => setTexto(formatearTiempo(desde)), 60_000)
    return () => clearInterval(id)
  }, [desde])

  return (
    <div className="mt-0.5 font-mono text-xs text-amber-600">{texto}</div>
  )
}

function formatearTiempo(desde: string): string {
  const diff = Date.now() - new Date(desde).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
