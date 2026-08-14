'use client'

// Feedback táctil ligero (sonido corto + vibración) para las acciones clave
// del POS: agregar producto, confirmar/enviar pedido, cobrar, cancelar. El
// tono se sintetiza con Web Audio API (sin archivos de audio que empaquetar
// ni servir). Respeta perfiles.sonido_activado/vibracion_activada,
// sincronizados una vez por sesión desde el layout server-side vía
// <FeedbackPrefsSync> — ver components/layout/FeedbackPrefsSync.tsx.
export type EventoFeedback = 'agregar' | 'confirmar' | 'cobrar' | 'cancelar'

const TONOS: Record<EventoFeedback, { frecuencia: number; duracionMs: number }> = {
  agregar: { frecuencia: 880, duracionMs: 55 },
  confirmar: { frecuencia: 660, duracionMs: 90 },
  cobrar: { frecuencia: 990, duracionMs: 130 },
  cancelar: { frecuencia: 320, duracionMs: 150 },
}

// navigator.vibrate() no tiene ningún efecto en iOS — Safari/WebKit nunca lo
// implementó, tampoco en una PWA instalada desde iOS. En esos dispositivos
// solo se escucha el tono, sin vibración; no hay forma confiable de avisarlo
// de antemano en la UI salvo detectar que 'vibrate' no existe en navigator
// (que es justo lo que hace el chequeo de abajo).
const VIBRACION_MS: Record<EventoFeedback, number> = {
  agregar: 15,
  confirmar: 25,
  cobrar: 35,
  cancelar: 50,
}

let prefs = { sonido_activado: true, vibracion_activada: true }
let audioCtx: AudioContext | null = null

export function setPreferenciasFeedback(sonidoActivado: boolean, vibracionActivada: boolean) {
  prefs = { sonido_activado: sonidoActivado, vibracion_activada: vibracionActivada }
}

function obtenerAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) audioCtx = new Ctor()
  return audioCtx
}

function reproducirTono(frecuencia: number, duracionMs: number) {
  const ctx = obtenerAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frecuencia
  gain.gain.setValueAtTime(0.16, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracionMs / 1000)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duracionMs / 1000)
}

export function dispararFeedback(evento: EventoFeedback) {
  if (prefs.sonido_activado) {
    const t = TONOS[evento]
    reproducirTono(t.frecuencia, t.duracionMs)
  }
  if (prefs.vibracion_activada && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(VIBRACION_MS[evento])
    } catch {
      // Algunos navegadores lanzan si no hay gesto de usuario reciente — no crítico.
    }
  }
}
