// Tiempo transcurrido de un pedido en mesa (F9-03) — independiente del
// semáforo de color de la mesa (ver colorMesa.ts): ese refleja el ESTADO de
// atención (sin atender / cobro parcial / etc.), esto es solo el dato del
// tiempo en sí, mostrado junto al temporizador en vivo de cada mesa ocupada.
export type ColorTiempoMesa = 'normal' | 'ambar' | 'rojo'

export function minutosTranscurridos(desde: string, ahoraMs: number = Date.now()): number {
  return Math.max(0, Math.floor((ahoraMs - new Date(desde).getTime()) / 60_000))
}

export function formatearTiempoMesa(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${h}h ${String(m).padStart(2, '0')}min`
}

// Ámbar al llegar al umbral configurado, rojo a 1.5x ese umbral — escalado
// simple para dar un segundo aviso más urgente sin agregar otro campo de
// configuración.
export function colorTiempoMesa(minutos: number, umbralMinutos: number): ColorTiempoMesa {
  if (umbralMinutos > 0 && minutos >= umbralMinutos * 1.5) return 'rojo'
  if (umbralMinutos > 0 && minutos >= umbralMinutos) return 'ambar'
  return 'normal'
}

export const ESTILO_TEXTO_TIEMPO_MESA: Record<ColorTiempoMesa, string> = {
  normal: 'text-text-3',
  ambar: 'text-amber-600',
  rojo: 'text-red-600',
}
