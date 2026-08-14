'use client'

import { useEffect, useState } from 'react'

// Una sola vez por sesión de navegador (sessionStorage, no localStorage —
// se repite si el usuario cierra la pestaña/app y vuelve a entrar, pero no
// en cada navegación interna dentro de la misma sesión).
const SESSION_KEY = 'griselda_splash_visto'
const HOLD_MS = 1300
const FADE_MS = 250

interface SplashScreenProps {
  nombre: string
  eslogan: string
}

export function SplashScreen({ nombre, eslogan }: SplashScreenProps) {
  // 'oculto' también es el estado inicial en el server (y en el primer
  // render del cliente, antes del efecto) — evita mismatch de hidratación,
  // ya que sessionStorage no existe en el server.
  const [fase, setFase] = useState<'oculto' | 'entrando' | 'visible' | 'saliendo'>('oculto')

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')

    setFase('entrando')
    // Doble rAF: si se pasa directo a 'visible' en el mismo tick, el
    // navegador nunca pinta el frame en opacity:0 y no hay nada que animar.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFase('visible'))
    })
    const salir = setTimeout(() => setFase('saliendo'), HOLD_MS)
    const ocultar = setTimeout(() => setFase('oculto'), HOLD_MS + FADE_MS)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(salir)
      clearTimeout(ocultar)
    }
  }, [])

  if (fase === 'oculto') return null

  return (
    <div
      className={`fixed inset-0 z-[300] flex flex-col items-center justify-center gap-3 bg-[#173F2E] px-8 text-center transition-opacity duration-[250ms] ${
        fase === 'visible' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-[28px] font-bold text-white">
        G
      </div>
      <p className="text-[22px] font-bold text-white">{nombre}</p>
      {eslogan && <p className="text-[13px] text-white/70">{eslogan}</p>}
    </div>
  )
}
