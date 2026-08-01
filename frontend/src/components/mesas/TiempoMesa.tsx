'use client'

import { useEffect, useState } from 'react'
import {
  minutosTranscurridos,
  formatearTiempoMesa,
  colorTiempoMesa,
  ESTILO_TEXTO_TIEMPO_MESA,
} from '@/lib/tiempoMesa'

// Temporizador de mesa en vivo (F9-03), compartido entre TarjetaMesa (lista
// en /mesas), PlanoMesas (mapa en /mesas) y LienzoMesasEditor (/mas/mapa-mesas)
// — se actualiza cada minuto sin recargar la página. Arranca en null para
// evitar mismatch de hidratación (Date.now() difiere servidor vs cliente).
export function TiempoMesa({
  desde,
  umbralMinutos,
  className = '',
}: {
  desde: string
  umbralMinutos: number
  className?: string
}) {
  const [minutos, setMinutos] = useState<number | null>(null)

  useEffect(() => {
    setMinutos(minutosTranscurridos(desde))
    const id = setInterval(() => setMinutos(minutosTranscurridos(desde)), 60_000)
    return () => clearInterval(id)
  }, [desde])

  if (minutos === null) return null

  const color = colorTiempoMesa(minutos, umbralMinutos)

  return (
    <span className={`font-mono ${ESTILO_TEXTO_TIEMPO_MESA[color]} ${className}`}>
      {formatearTiempoMesa(minutos)}
    </span>
  )
}
