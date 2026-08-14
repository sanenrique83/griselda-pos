'use client'

import { useEffect } from 'react'
import { setPreferenciasFeedback } from '@/lib/feedback'

// Puente server→client para lib/feedback.ts: el layout ya carga el perfil
// completo (select('*')) para el header, así que no hace falta una consulta
// aparte desde el cliente — solo empujar los dos booleans al módulo singleton.
export function FeedbackPrefsSync({
  sonidoActivado,
  vibracionActivada,
}: {
  sonidoActivado: boolean
  vibracionActivada: boolean
}) {
  useEffect(() => {
    setPreferenciasFeedback(sonidoActivado, vibracionActivada)
  }, [sonidoActivado, vibracionActivada])

  return null
}
