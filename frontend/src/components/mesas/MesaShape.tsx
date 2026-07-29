import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

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

/**
 * Representación visual de una mesa (forma real según `forma`/`tamano`,
 * rotada según `rotacion`). Compartida entre el plano de solo lectura de
 * `/mesas` (POS) y el editor de posiciones en `/mas/mapa-mesas`.
 *
 * `anilloColor` marca visualmente que esta mesa está unida (vía pedido_mesas)
 * a otras — se usa `outline` en vez de sumarse a `shadow-card` para no pisar
 * la sombra propia de la mesa.
 */
export function MesaShape({
  forma,
  tamano,
  rotacion,
  ocupada = false,
  anilloColor,
  children,
}: {
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  ocupada?: boolean
  anilloColor?: string
  children?: React.ReactNode
}) {
  const { width, height, radius } = dimensionesMesa(forma, tamano)

  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 border-[1.5px] shadow-card select-none ${
        ocupada ? 'border-[#FDE68A] bg-[#FFFDF0]' : 'border-[#E5E5EA] bg-white'
      }`}
      style={{
        width,
        height,
        borderRadius: radius,
        transform: `rotate(${rotacion}deg)`,
        outline: anilloColor ? `3px solid ${anilloColor}` : undefined,
        outlineOffset: anilloColor ? 2 : undefined,
      }}
    >
      {children}
    </div>
  )
}
