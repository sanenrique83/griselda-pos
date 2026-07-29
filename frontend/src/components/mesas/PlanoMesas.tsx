'use client'

import { MesaShape } from './MesaShape'
import { TarjetaMesa } from './TarjetaMesa'
import type { MesaUI } from '@/app/(app)/mesas/page'

const MARGEN = 100

/**
 * Plano de solo lectura (sin drag) para la pantalla `/mesas` del POS —
 * misma disposición configurada en `/mas/mapa-mesas`, pero de tocar-para-
 * abrir en vez de arrastrar. Las mesas sin posición asignada (pos_x/pos_y
 * nulos) no tienen dónde dibujarse en el lienzo, así que se listan aparte
 * para que sigan siendo accesibles.
 */
export function PlanoMesas({
  mesas,
  onMesaClick,
}: {
  mesas: MesaUI[]
  onMesaClick: (mesa: MesaUI) => void
}) {
  const posicionadas = mesas.filter((m) => m.pos_x !== null && m.pos_y !== null)
  const sinPosicion = mesas.filter((m) => m.pos_x === null || m.pos_y === null)

  const maxX = Math.max(400, ...posicionadas.map((m) => m.pos_x! + MARGEN))
  const maxY = Math.max(300, ...posicionadas.map((m) => m.pos_y! + MARGEN))

  return (
    <div>
      <div className="overflow-auto px-3 pt-3">
        <div className="relative" style={{ width: maxX, height: maxY }}>
          {posicionadas.map((mesa) => (
            <button
              key={mesa.id}
              onClick={() => onMesaClick(mesa)}
              className="absolute active:scale-[.96] transition-transform"
              style={{ left: mesa.pos_x!, top: mesa.pos_y! }}
            >
              <MesaShape
                forma={mesa.forma}
                tamano={mesa.tamano}
                rotacion={mesa.rotacion}
                ocupada={mesa.pedido_activo !== null}
              >
                <span className="text-[13px] font-bold leading-none">
                  {mesa.nombre ?? mesa.numero}
                </span>
                {mesa.pedido_activo && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </MesaShape>
            </button>
          ))}
        </div>
      </div>

      {sinPosicion.length > 0 && (
        <div className="px-3 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-text-3">
            Sin posición en el mapa
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {sinPosicion.map((mesa) => (
              <TarjetaMesa key={mesa.id} mesa={mesa} onClick={() => onMesaClick(mesa)} isPending={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
