import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

const TAMANO_PX: Record<TamanoMesa, number> = { chico: 52, medio: 68, grande: 84 }

export function dimensionesMesa(forma: FormaMesa, tamano: TamanoMesa) {
  const base = TAMANO_PX[tamano]
  if (forma === 'circulo') return { width: base, height: base, radius: 9999 }
  if (forma === 'cuadrado') return { width: base, height: base, radius: 10 }
  return { width: Math.round(base * 1.5), height: base, radius: 10 } // rectangulo
}

/**
 * Representación visual de una mesa (forma real según `forma`/`tamano`,
 * rotada según `rotacion`). Compartida entre el plano de solo lectura de
 * `/mesas` (POS) y el editor de posiciones en `/mas/mapa-mesas`.
 */
export function MesaShape({
  forma,
  tamano,
  rotacion,
  ocupada = false,
  children,
}: {
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  ocupada?: boolean
  children?: React.ReactNode
}) {
  const { width, height, radius } = dimensionesMesa(forma, tamano)

  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 border-[1.5px] shadow-card select-none ${
        ocupada ? 'border-[#FDE68A] bg-[#FFFDF0]' : 'border-[#E5E5EA] bg-white'
      }`}
      style={{ width, height, borderRadius: radius, transform: `rotate(${rotacion}deg)` }}
    >
      {children}
    </div>
  )
}
