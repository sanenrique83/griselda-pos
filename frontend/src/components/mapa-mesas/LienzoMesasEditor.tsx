'use client'

import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { MesaShape } from '@/components/mesas/MesaShape'
import { guardarDisposicion } from '@/app/(app)/mas/mapa-mesas/actions'
import type { MesaEditable } from '@/app/(app)/mas/mapa-mesas/page'

const CANVAS_W = 900
const CANVAS_H = 1100
const PASO_AUTO = 90 // separación al auto-acomodar mesas sin posición
const COLUMNAS_AUTO = 6

type Posicion = { x: number; y: number; rotacion: number }

// Mesas sin pos_x/pos_y (nunca se han colocado en el mapa) se acomodan en
// una cuadrícula temporal para que aparezcan en el lienzo desde el primer
// uso — quedan marcadas "sucias" para que "Guardar disposición" persista
// esa posición inicial en vez de perderla al recargar.
function posicionesIniciales(mesas: MesaEditable[]): Record<number, Posicion> {
  const posiciones: Record<number, Posicion> = {}
  let indiceSinPosicion = 0
  for (const mesa of mesas) {
    if (mesa.posX !== null && mesa.posY !== null) {
      posiciones[mesa.id] = { x: mesa.posX, y: mesa.posY, rotacion: mesa.rotacion }
    } else {
      const col = indiceSinPosicion % COLUMNAS_AUTO
      const fila = Math.floor(indiceSinPosicion / COLUMNAS_AUTO)
      posiciones[mesa.id] = {
        x: 30 + col * PASO_AUTO,
        y: 30 + fila * PASO_AUTO,
        rotacion: mesa.rotacion,
      }
      indiceSinPosicion++
    }
  }
  return posiciones
}

export function LienzoMesasEditor({ mesas }: { mesas: MesaEditable[] }) {
  const [posiciones, setPosiciones] = useState<Record<number, Posicion>>(() =>
    posicionesIniciales(mesas),
  )
  const [dirty, setDirty] = useState<Set<number>>(
    () => new Set(mesas.filter((m) => m.posX === null || m.posY === null).map((m) => m.id)),
  )
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const id = Number(event.active.id)
    const { delta } = event
    if (delta.x === 0 && delta.y === 0) return

    setPosiciones((prev) => {
      const actual = prev[id]
      if (!actual) return prev
      const x = Math.min(Math.max(0, Math.round(actual.x + delta.x)), CANVAS_W - 20)
      const y = Math.min(Math.max(0, Math.round(actual.y + delta.y)), CANVAS_H - 20)
      return { ...prev, [id]: { ...actual, x, y } }
    })
    setDirty((prev) => new Set(prev).add(id))
  }

  function handleRotar(id: number) {
    setPosiciones((prev) => {
      const actual = prev[id]
      if (!actual) return prev
      return { ...prev, [id]: { ...actual, rotacion: (actual.rotacion + 90) % 360 } }
    })
    setDirty((prev) => new Set(prev).add(id))
  }

  async function handleGuardar() {
    if (dirty.size === 0) return
    setGuardando(true)
    setMensaje(null)
    const cambios = [...dirty].map((id) => ({
      id,
      posX: posiciones[id].x,
      posY: posiciones[id].y,
      rotacion: posiciones[id].rotacion,
    }))
    const res = await guardarDisposicion(cambios)
    setGuardando(false)
    if ('error' in res) {
      setMensaje({ tipo: 'error', texto: res.error })
    } else {
      setMensaje({ tipo: 'ok', texto: 'Disposición guardada.' })
      setDirty(new Set())
    }
  }

  return (
    <div className="min-h-full bg-s2">
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <h1 className="text-[20px] font-bold leading-tight">Mapa de mesas</h1>
        <p className="mt-0.5 text-[13px] text-text-3">
          Arrastra cada mesa a su lugar · toca ⟳ para rotarla
        </p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {mesas.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-card px-4 py-8 text-center">
            <p className="text-sm text-text-3">
              No hay mesas activas. Agrégalas desde Más → Catálogo.
            </p>
          </div>
        ) : (
          <>
            {mensaje && (
              <p
                className={`text-center text-xs font-semibold ${
                  mensaje.tipo === 'ok' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {mensaje.texto}
              </p>
            )}

            <div
              className="rounded-2xl bg-white shadow-card overflow-auto"
              style={{ maxHeight: '65vh' }}
            >
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
                  {mesas.map((mesa) => (
                    <MesaDraggable
                      key={mesa.id}
                      mesa={mesa}
                      posicion={posiciones[mesa.id]}
                      onRotar={() => handleRotar(mesa.id)}
                    />
                  ))}
                </div>
              </DndContext>
            </div>

            <button
              onClick={handleGuardar}
              disabled={dirty.size === 0 || guardando}
              className="w-full rounded-xl bg-blue-600 py-3.5 text-[15px] font-semibold text-white active:opacity-70 disabled:opacity-40"
            >
              {guardando
                ? 'Guardando…'
                : `Guardar disposición${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
            </button>
          </>
        )}

        <div className="h-2" />
      </div>
    </div>
  )
}

function MesaDraggable({
  mesa,
  posicion,
  onRotar,
}: {
  mesa: MesaEditable
  posicion: Posicion
  onRotar: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(mesa.id),
  })

  const style: React.CSSProperties = {
    left: posicion.x,
    top: posicion.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 10 : 1,
  }

  return (
    <div ref={setNodeRef} className="absolute" style={style}>
      <div {...listeners} {...attributes} className="cursor-grab touch-none active:cursor-grabbing">
        <MesaShape forma={mesa.forma} tamano={mesa.tamano} rotacion={posicion.rotacion}>
          <span className="text-[12px] font-bold leading-none">{mesa.nombre ?? mesa.numero}</span>
        </MesaShape>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRotar()
        }}
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[12px] text-white shadow-card active:opacity-70"
      >
        ⟳
      </button>
    </div>
  )
}
