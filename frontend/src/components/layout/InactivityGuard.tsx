'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const EVENTOS_ACTIVIDAD = ['click', 'touchstart', 'keydown'] as const
const MENSAJE_INACTIVIDAD = 'Sesión cerrada por inactividad'

/**
 * Cierra la sesión automáticamente si no hay actividad del usuario durante
 * `timeoutMinutos`. Vive en el layout de (app) — se monta una sola vez y
 * persiste mientras el usuario navega entre pantallas autenticadas.
 */
export function InactivityGuard({ timeoutMinutos }: { timeoutMinutos: number }) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 0 o negativo desactiva el cierre automático (config manual del admin).
    if (timeoutMinutos <= 0) return

    const supabase = createClient()

    async function cerrarPorInactividad() {
      await supabase.auth.signOut()
      router.push(`/login?mensaje=${encodeURIComponent(MENSAJE_INACTIVIDAD)}`)
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(cerrarPorInactividad, timeoutMinutos * 60_000)
    }

    resetTimer()
    for (const evento of EVENTOS_ACTIVIDAD) {
      window.addEventListener(evento, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const evento of EVENTOS_ACTIVIDAD) {
        window.removeEventListener(evento, resetTimer)
      }
    }
  }, [timeoutMinutos, router])

  return null
}
