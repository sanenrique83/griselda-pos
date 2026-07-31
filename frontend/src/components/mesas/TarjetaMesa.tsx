'use client'

import { useEffect, useState } from 'react'
import type { MesaUI } from '@/app/(app)/mesas/page'
import { colorSemaforoMesa, type ColorMesa } from '@/lib/colorMesa'

interface TarjetaMesaProps {
  mesa: MesaUI
  onClick: () => void
  isPending: boolean
  alertaActiva: boolean
  alertaMinutos: number
}

const ESTILO_TARJETA: Record<ColorMesa, { border: string; bg: string; badgeBg: string; badgeText: string; label: string }> = {
  verde:   { border: 'border-[#E5E5EA]', bg: 'bg-white',    badgeBg: 'bg-green-50',  badgeText: 'text-green-600',  label: '○ Libre' },
  naranja: { border: 'border-[#FDE68A]', bg: 'bg-[#FFFDF0]', badgeBg: 'bg-amber-50',  badgeText: 'text-amber-600',  label: '● Ocupada' },
  azul:    { border: 'border-[#BFDBFE]', bg: 'bg-[#EFF6FF]', badgeBg: 'bg-blue-50',   badgeText: 'text-blue-600',   label: '● Cobro parcial' },
  rojo:    { border: 'border-[#FCA5A5]', bg: 'bg-[#FEF2F2]', badgeBg: 'bg-red-50',    badgeText: 'text-red-600',    label: '● Sin atender' },
}

export function TarjetaMesa({ mesa, onClick, isPending, alertaActiva, alertaMinutos }: TarjetaMesaProps) {
  const ocupada = mesa.pedido_activo !== null

  // Reevalúa el semáforo cada 30s — el color depende del tiempo transcurrido
  // (alerta roja), no solo del estado guardado en el servidor.
  const [ahora, setAhora] = useState<number | null>(null)
  useEffect(() => {
    setAhora(Date.now())
    const id = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const color = colorSemaforoMesa(
    {
      ocupada,
      algunoPagadoNoTodos: mesa.pedido_activo?.algunoPagadoNoTodos ?? false,
      tieneProductos: mesa.pedido_activo?.tieneProductos ?? false,
      pedidoCreatedAt: mesa.pedido_activo?.created_at ?? null,
      alertaActiva,
      alertaMinutos,
    },
    ahora ?? undefined,
  )
  const estilo = ESTILO_TARJETA[color]

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`relative w-full rounded-xl p-3.5 text-left shadow-card transition-transform active:scale-[.97] disabled:opacity-60 border-[1.5px] ${estilo.border} ${estilo.bg}`}
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
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${estilo.badgeBg} ${estilo.badgeText}`}
        >
          {estilo.label}
        </span>
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
// Inicializamos con '' para evitar mismatch de hidratación (Date.now() difiere server vs client)
function TiempoTranscurrido({ desde }: { desde: string }) {
  const [texto, setTexto] = useState('')

  useEffect(() => {
    setTexto(formatearTiempo(desde))
    const id = setInterval(() => setTexto(formatearTiempo(desde)), 60_000)
    return () => clearInterval(id)
  }, [desde])

  if (!texto) return null

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
