import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'
import { ESTILO_COLOR_MESA, type ColorMesa } from '@/lib/colorMesa'

const TAMANO_PX: Record<TamanoMesa, number> = { chico: 52, medio: 68, grande: 84 }

export function dimensionesMesa(forma: FormaMesa, tamano: TamanoMesa) {
  const base = TAMANO_PX[tamano]
  if (forma === 'circulo') return { width: base, height: base, radius: 9999 }
  if (forma === 'cuadrado') return { width: base, height: base, radius: 10 }
  return { width: Math.round(base * 1.5), height: base, radius: 10 } // rectangulo
}

// Paleta para distinguir grupos de mesas unidas (unirMesas persistente) en el
// plano — se asigna por índice de grupo, cíclica si hay más grupos que colores.
const COLORES_GRUPO = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444']

export function colorParaGrupo(indice: number): string {
  return COLORES_GRUPO[indice % COLORES_GRUPO.length]
}

// Un marcador de silla, en coordenadas LOCALES centro-relativas (mismo
// sistema que devuelve `calcularPosicionesSillas`/`calcularPosicionesSillasCadena`
// en lib/asientos.ts) — MesaShape no calcula posiciones, solo dibuja las que
// le pasan, para no duplicar esa geometría aquí (y evitar un import circular
// con lib/asientos.ts, que ya importa `dimensionesMesa` de este archivo).
// `anguloDeg` es la normal saliente en ese punto (ver lib/asientos.ts) — con
// eso se rota el medio círculo para que el lado curvo (asiento) quede hacia
// afuera y el lado recto (respaldo) hacia el centro de la mesa.
export type MarcadorSilla = { x: number; y: number; anguloDeg: number; ocupada: boolean }

/**
 * Representación visual de una mesa (forma real según `forma`/`tamano`,
 * rotada según `rotacion`). Compartida entre el plano de solo lectura de
 * `/mesas` (POS) y el editor de posiciones en `/mas/mapa-mesas`.
 *
 * `anilloColor` marca visualmente que esta mesa está unida (vía pedido_mesas)
 * a otras — se usa `outline` en vez de sumarse a `shadow-card` para no pisar
 * la sombra propia de la mesa.
 *
 * `marcadores` dibuja medios círculos pequeños alrededor de la silueta (el
 * lado recto —respaldo— hacia el centro de la mesa, el lado curvo —asiento—
 * hacia afuera, rotado según `anguloDeg`) — rellenos si `ocupada`, solo
 * contorno si no — para ver de un vistazo cuántos asientos están tomados
 * sin abrir la mesa.
 *
 * `colorEstado` es el semáforo completo de la mesa (ver lib/colorMesa.ts) —
 * reemplaza al viejo booleano `ocupada`, que solo distinguía 2 estados.
 */
export function MesaShape({
  forma,
  tamano,
  rotacion,
  colorEstado = 'verde',
  anilloColor,
  marcadores,
  children,
}: {
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  colorEstado?: ColorMesa
  anilloColor?: string
  marcadores?: MarcadorSilla[]
  children?: React.ReactNode
}) {
  const { width, height, radius } = dimensionesMesa(forma, tamano)
  const estilo = ESTILO_COLOR_MESA[colorEstado]

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-0.5 border-[1.5px] shadow-card select-none"
      style={{
        width,
        height,
        borderRadius: radius,
        borderColor: estilo.border,
        backgroundColor: estilo.bg,
        transform: `rotate(${rotacion}deg)`,
        outline: anilloColor ? `3px solid ${anilloColor}` : undefined,
        outlineOffset: anilloColor ? 2 : undefined,
      }}
    >
      {children}

      {marcadores?.map((m, idx) => (
        <svg
          key={idx}
          width={16}
          height={16}
          viewBox="-8 -8 16 16"
          className="pointer-events-none absolute"
          style={{
            left: width / 2 + m.x,
            top: height / 2 + m.y,
            transform: `translate(-50%, -50%) rotate(${m.anguloDeg}deg)`,
          }}
        >
          {/* Medio círculo centrado en el origen: lado recto en x=0 (hacia
              el centro de la mesa antes de rotar), lado curvo hacia +x
              (hacia afuera) — `anguloDeg` lo rota a su orientación real. */}
          <path
            d="M 0,-8 A 8 8 0 0 1 0,8 Z"
            fill={m.ocupada ? '#f59e0b' : 'none'}
            stroke={m.ocupada ? 'none' : '#C7C7CC'}
            strokeWidth={1.5}
          />
        </svg>
      ))}
    </div>
  )
}
