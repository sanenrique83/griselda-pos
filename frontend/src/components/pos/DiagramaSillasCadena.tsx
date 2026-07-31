import { MesaShape, dimensionesMesa } from '@/components/mesas/MesaShape'
import { calcularPosicionesSillasCadena } from '@/lib/asientos'

// Versión "cadena" de DiagramaSillas: en vez de UNA mesa con forma real, dibuja
// N mesas (rectángulo, tamaño de referencia — ver nota en lib/asientos.ts)
// pegadas en fila, con los marcadores de silla de toda la cadena encima. No
// rota nada (una cadena de mesas unidas no tiene un solo `rotacion` propio,
// cada mesa física conserva el suyo en el mapa — aquí solo importa la
// geometría relativa de asientos, no la disposición real en el plano).
interface DiagramaSillasCadenaProps {
  mesas: { capacidad: number }[]
  renderSilla: (sillaNum: number) => React.ReactNode
}

export function DiagramaSillasCadena({ mesas, renderSilla }: DiagramaSillasCadenaProps) {
  const puntos = calcularPosicionesSillasCadena(mesas)
  const { width: anchoIndividual, height: alto } = dimensionesMesa('rectangulo', 'medio')
  const anchoTotal = anchoIndividual * mesas.length
  const boxW = anchoTotal + 90
  const boxH = alto + 90

  return (
    <div className="flex justify-center py-2 overflow-x-auto">
      <div className="relative flex-shrink-0" style={{ width: boxW, height: boxH }}>
        <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%)' }}>
          <div
            className="flex"
            style={{ position: 'absolute', left: -anchoTotal / 2, top: -alto / 2 }}
          >
            {mesas.map((_, idx) => (
              <MesaShape key={idx} forma="rectangulo" tamano="medio" rotacion={0} />
            ))}
          </div>

          {puntos.map((p, idx) => (
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
