'use client'

import { useEffect, useState } from 'react'
import { esErrorDeCarga } from '@/lib/errorCarga'

// Boundary de error de ÚLTIMO recurso — solo se activa si el error ocurre
// en el root layout mismo (fuera del alcance de app/(app)/error.tsx).
// Reemplaza el layout raíz por completo, así que trae su propio
// <html>/<body> y usa estilos inline en vez de clases de Tailwind: si
// justo esto se dispara por una falla de carga de chunk, no hay garantía
// de que el CSS del layout normal ya esté disponible.
export default function GlobalError({
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

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F5F5F7', color: '#1C1C1E' }}>
        <div
          style={{
            display: 'flex',
            minHeight: '100dvh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          {recargando ? (
            <>
              <div
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: '50%',
                  border: '4px solid rgba(23,63,46,0.2)',
                  borderTopColor: '#173F2E',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ fontSize: 14, color: '#636366' }}>Actualizando…</p>
              <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
            </>
          ) : (
            <>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Algo salió mal</p>
              <p style={{ fontSize: 14, color: '#636366' }}>{error.message || 'Ocurrió un error inesperado.'}</p>
              <button
                onClick={reset}
                style={{
                  borderRadius: 999,
                  background: '#173F2E',
                  color: '#fff',
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                }}
              >
                Reintentar
              </button>
            </>
          )}
        </div>
      </body>
    </html>
  )
}
