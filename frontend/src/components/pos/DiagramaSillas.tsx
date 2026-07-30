import { MesaShape, dimensionesMesa } from '@/components/mesas/MesaShape'
import { calcularPosicionesSillas } from '@/lib/asientos'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

// Geometría pura: dibuja la mesa (reutilizando MesaShape) y monta un
// marcador por cada silla en su posición calculada (ver lib/asientos.ts).
// No sabe nada de "ocupada/vacía/seleccionada" — el llamador decide cómo se
// ve y se comporta cada silla vía `renderSilla`, para poder reusarse tanto
// en el picker de silla inicial (pos/nueva/[mesaId]) como en el sheet de
// reasignación (SheetAsientos, dentro de la comanda).
interface DiagramaSillasProps {
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  asientosHorario: boolean
  numSillas: number
  renderSilla: (sillaNum: number) => React.ReactNode
}

export function DiagramaSillas({
  forma,
  tamano,
  rotacion,
  asientosHorario,
  numSillas,
  renderSilla,
}: DiagramaSillasProps) {
  const posiciones = calcularPosicionesSillas(numSillas, forma, tamano, asientosHorario)
  const { width, height } = dimensionesMesa(forma, tamano)
  const boxSize = Math.sqrt(width * width + height * height) + 90

  return (
    <div className="flex justify-center py-2">
      <div className="relative" style={{ width: boxSize, height: boxSize }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{ transform: `translate(-50%, -50%) rotate(${rotacion}deg)` }}
        >
          <div style={{ position: 'absolute', left: -width / 2, top: -height / 2 }}>
            <MesaShape forma={forma} tamano={tamano} rotacion={0} />
          </div>

          {posiciones.map((p, idx) => (
            <div
              key={idx + 1}
              style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}
            >
              {renderSilla(idx + 1)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
