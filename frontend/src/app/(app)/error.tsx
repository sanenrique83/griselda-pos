'use client'

import { useEffect, useState } from 'react'
import { esErrorDeCarga } from '@/lib/errorCarga'

// Boundary de error para todo el grupo (app) — cubre pantalla en blanco al
// navegar entre rutas (síntoma real: ChunkLoadError sin manejar cuando hay
// un deploy nuevo mientras la app ya estaba abierta). Si el error es de
// carga de chunk, recarga solo automáticamente; para un bug real de la app
// se queda visible con botón "Reintentar" en vez de ocultarlo con un
// reload silencioso.
export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [recargando, setRecargando] = useState(false)

  useEffect(() => {
    if (esErrorDeCarga(error)) {
      setRecargando(true)
      window.location.reload()
    }
  }, [error])

  if (recargando) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#173F2E]/20 border-t-[#173F2E]" />
        <p className="text-sm text-text-3">Actualizando…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-base font-semibold text-text">Algo salió mal</p>
      <p className="text-sm text-text-3">{error.message || 'Ocurrió un error inesperado.'}</p>
      <button
        onClick={reset}
        className="rounded-full bg-[#173F2E] px-5 py-2.5 text-sm font-semibold text-white active:bg-[#0F2E21]"
      >
        Reintentar
      </button>
    </div>
  )
}
