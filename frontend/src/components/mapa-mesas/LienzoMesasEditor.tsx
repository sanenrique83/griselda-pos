'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { BotonRegresarMas } from '@/components/layout/BotonRegresarMas'
import { MesaShape, dimensionesMesa, colorParaGrupo } from '@/components/mesas/MesaShape'
import { guardarDisposicion } from '@/app/(app)/mas/mapa-mesas/actions'
import { unirMesas } from '@/app/(app)/pos/[pedidoId]/actions'
import { calcularPosicionesSillas } from '@/lib/asientos'
import { colorSemaforoMesa } from '@/lib/colorMesa'
import type { MesaEditable } from '@/app/(app)/mas/mapa-mesas/page'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

const CANVAS_W = 900
const CANVAS_H = 1100
const PASO_AUTO = 90 // separación al auto-acomodar mesas sin posición
const COLUMNAS_AUTO = 6
const CUADRICULA_PX = 40 // tamaño de la cuadrícula de fondo, solo visual
const UMBRAL_IMAN_PX = 40 // distancia (entre bordes de las cajas) para "imantar"
const COLOR_IMAN = '#22c55e'

// Distancia entre los bordes de dos cajas rectangulares alineadas a los ejes
// (AABB) — 0 si se traslapan. Aproxima "qué tan cerca están de tocarse" sin
// importar si una mesa es chica/grande o si su forma real es circular
// (para efectos de imantado solo interesa la caja contenedora).
function distanciaEntreCajas(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0)
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0)
  return Math.sqrt(dx * dx + dy * dy)
}

type Posicion = {
  x: number
  y: number
  rotacion: number
  forma: FormaMesa
  tamano: TamanoMesa
}

// Mesas sin pos_x/pos_y (nunca se han colocado en el mapa) se acomodan en
// una cuadrícula temporal para que aparezcan en el lienzo desde el primer
// uso — quedan marcadas "sucias" para que "Guardar disposición" persista
// esa posición inicial en vez de perderla al recargar.
function posicionesIniciales(mesas: MesaEditable[]): Record<number, Posicion> {
  const posiciones: Record<number, Posicion> = {}
  let indiceSinPosicion = 0
  for (const mesa of mesas) {
    if (mesa.posX !== null && mesa.posY !== null) {
      posiciones[mesa.id] = {
        x: mesa.posX,
        y: mesa.posY,
        rotacion: mesa.rotacion,
        forma: mesa.forma,
        tamano: mesa.tamano,
      }
    } else {
      const col = indiceSinPosicion % COLUMNAS_AUTO
      const fila = Math.floor(indiceSinPosicion / COLUMNAS_AUTO)
      posiciones[mesa.id] = {
        x: 30 + col * PASO_AUTO,
        y: 30 + fila * PASO_AUTO,
        rotacion: mesa.rotacion,
        forma: mesa.forma,
        tamano: mesa.tamano,
      }
      indiceSinPosicion++
    }
  }
  return posiciones
}

export function LienzoMesasEditor({
  mesas,
  alertaActiva,
  alertaMinutos,
}: {
  mesas: MesaEditable[]
  alertaActiva: boolean
  alertaMinutos: number
}) {
  const router = useRouter()
  const [posiciones, setPosiciones] = useState<Record<number, Posicion>>(() =>
    posicionesIniciales(mesas),
  )
  const [dirty, setDirty] = useState<Set<number>>(
    () => new Set(mesas.filter((m) => m.posX === null || m.posY === null).map((m) => m.id)),
  )
  const [seleccionId, setSeleccionId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [magnetTargetId, setMagnetTargetId] = useState<number | null>(null)
  const [uniendo, setUniendo] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const mesaPorId = new Map(mesas.map((m) => [m.id, m]))

  function actualizarMesa(id: number, patch: Partial<Posicion>) {
    setPosiciones((prev) => {
      const actual = prev[id]
      if (!actual) return prev
      return { ...prev, [id]: { ...actual, ...patch } }
    })
    setDirty((prev) => new Set(prev).add(id))
  }

  // Candidato de imantado: mesa OCUPADA más cercana (por borde de caja, no
  // centro — para que el umbral se sienta igual sin importar chico/grande),
  // de un pedido distinto al de la mesa que se arrastra. Solo mesas ocupadas
  // participan — no tiene sentido "unir" una mesa libre, unirMesas() opera
  // sobre pedidos, no sobre mesas sueltas.
  function buscarCandidatoIman(draggedId: number, liveX: number, liveY: number): number | null {
    const draggedMesa = mesaPorId.get(draggedId)
    if (!draggedMesa?.pedidoActivoId) return null
    const draggedPos = posiciones[draggedId]
    if (!draggedPos) return null
    const { width: w, height: h } = dimensionesMesa(draggedPos.forma, draggedPos.tamano)
    const cajaArrastrada = { x: liveX, y: liveY, w, h }

    let mejorId: number | null = null
    let mejorDist = Infinity
    for (const mesa of mesas) {
      if (mesa.id === draggedId) continue
      if (!mesa.pedidoActivoId || mesa.pedidoActivoId === draggedMesa.pedidoActivoId) continue
      const pos = posiciones[mesa.id]
      if (!pos) continue
      const { width, height } = dimensionesMesa(pos.forma, pos.tamano)
      const dist = distanciaEntreCajas(cajaArrastrada, { x: pos.x, y: pos.y, w: width, h: height })
      if (dist <= UMBRAL_IMAN_PX && dist < mejorDist) {
        mejorDist = dist
        mejorId = mesa.id
      }
    }
    return mejorId
  }

  function handleDragMove(event: DragMoveEvent) {
    const id = Number(event.active.id)
    const actual = posiciones[id]
    if (!actual) return
    const liveX = actual.x + event.delta.x
    const liveY = actual.y + event.delta.y
    setMagnetTargetId(buscarCandidatoIman(id, liveX, liveY))
  }

  function handleDragEnd(event: DragEndEvent) {
    const id = Number(event.active.id)
    const { delta } = event
    const targetId = magnetTargetId
    setMagnetTargetId(null)
    if (delta.x === 0 && delta.y === 0 && targetId === null) return

    const actual = posiciones[id]
    if (!actual) return
    const x = Math.min(Math.max(0, Math.round(actual.x + delta.x)), CANVAS_W - 20)
    const y = Math.min(Math.max(0, Math.round(actual.y + delta.y)), CANVAS_H - 20)

    if (targetId !== null) {
      const draggedMesa = mesaPorId.get(id)
      const targetMesa = mesaPorId.get(targetId)
      const targetPos = posiciones[targetId]
      if (draggedMesa?.pedidoActivoId && targetMesa?.pedidoActivoId && targetPos) {
        setUniendo(true)
        setMensaje(null)
        unirMesas(draggedMesa.pedidoActivoId, targetMesa.pedidoActivoId).then((result) => {
          setUniendo(false)
          if (result?.error) {
            setMensaje({ tipo: 'error', texto: result.error })
            actualizarMesa(id, { x, y })
            return
          }
          // Efecto solo visual: acomoda la mesa arrastrada tocando a la
          // principal — no afecta el cálculo de sillas (eso usa el orden
          // guardado en pedido_mesas, no la posición en el mapa).
          const { width: targetWidth } = dimensionesMesa(targetPos.forma, targetPos.tamano)
          const nuevaX = Math.min(Math.max(0, Math.round(targetPos.x + targetWidth)), CANVAS_W - 20)
          const nuevaY = Math.min(Math.max(0, Math.round(targetPos.y)), CANVAS_H - 20)
          actualizarMesa(id, { x: nuevaX, y: nuevaY, rotacion: targetPos.rotacion })
          setMensaje({ tipo: 'ok', texto: `${draggedMesa.nombre ?? draggedMesa.numero} unida.` })
          router.refresh()
        })
        return
      }
    }

    actualizarMesa(id, { x, y })
  }

  function handleRotar(id: number) {
    const actual = posiciones[id]
    if (!actual) return
    actualizarMesa(id, { rotacion: (actual.rotacion + 90) % 360 })
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
      forma: posiciones[id].forma,
      tamano: posiciones[id].tamano,
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

  // Mesas unidas (mismo pedidoActivoId, vía unirMesas persistente) — conector
  // visual igual que en /mesas, calculado sobre la posición/forma EN VIVO
  // (aunque todavía no se haya guardado) para que se sienta consistente
  // mientras se edita.
  const gruposMap = new Map<number, MesaEditable[]>()
  for (const mesa of mesas) {
    if (!mesa.pedidoActivoId) continue
    const arr = gruposMap.get(mesa.pedidoActivoId) ?? []
    arr.push(mesa)
    gruposMap.set(mesa.pedidoActivoId, arr)
  }
  const grupos = [...gruposMap.entries()]
    .filter(([, ms]) => ms.length >= 2)
    .sort((a, b) => a[0] - b[0])

  const colorPorMesa = new Map<number, string>()
  const lineas: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []

  grupos.forEach(([, ms], idx) => {
    const color = colorParaGrupo(idx)
    const ordenadas = [...ms].sort((a, b) => a.id - b.id)
    const centros = ordenadas
      .map((m) => posiciones[m.id] && { id: m.id, pos: posiciones[m.id] })
      .filter((v): v is { id: number; pos: Posicion } => !!v)
      .map(({ id, pos }) => {
        const { width, height } = dimensionesMesa(pos.forma, pos.tamano)
        colorPorMesa.set(id, color)
        return { x: pos.x + width / 2, y: pos.y + height / 2 }
      })
    for (let i = 0; i < centros.length - 1; i++) {
      lineas.push({
        x1: centros[i].x,
        y1: centros[i].y,
        x2: centros[i + 1].x,
        y2: centros[i + 1].y,
        color,
      })
    }
  })

  const mesaSeleccionada = seleccionId !== null ? mesas.find((m) => m.id === seleccionId) : undefined
  const posicionSeleccionada = seleccionId !== null ? posiciones[seleccionId] : undefined

  return (
    <div className="min-h-full bg-s2">
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <BotonRegresarMas />
        <h1 className="mt-1 text-[20px] font-bold leading-tight">Mapa de mesas</h1>
        <p className="mt-0.5 text-[13px] text-text-3">
          Arrastra cada mesa a su lugar · tócala para editar forma, tamaño y rotación
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
              <DndContext sensors={sensors} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
                <div
                  className="relative"
                  style={{
                    width: CANVAS_W,
                    height: CANVAS_H,
                    backgroundImage:
                      'linear-gradient(to right, #E5E5EA 1px, transparent 1px), linear-gradient(to bottom, #E5E5EA 1px, transparent 1px)',
                    backgroundSize: `${CUADRICULA_PX}px ${CUADRICULA_PX}px`,
                  }}
                >
                  {lineas.length > 0 && (
                    <svg className="pointer-events-none absolute inset-0" width={CANVAS_W} height={CANVAS_H}>
                      {lineas.map((l, i) => (
                        <line
                          key={i}
                          x1={l.x1}
                          y1={l.y1}
                          x2={l.x2}
                          y2={l.y2}
                          stroke={l.color}
                          strokeWidth={3}
                          strokeDasharray="6 4"
                          strokeLinecap="round"
                        />
                      ))}
                    </svg>
                  )}

                  {mesas.map((mesa) => (
                    <MesaDraggable
                      key={mesa.id}
                      mesa={mesa}
                      posicion={posiciones[mesa.id]}
                      seleccionada={seleccionId === mesa.id}
                      anilloColor={
                        mesa.id === magnetTargetId ? COLOR_IMAN : colorPorMesa.get(mesa.id)
                      }
                      magnetActivo={magnetTargetId !== null}
                      colorEstado={colorSemaforoMesa(
                        {
                          ocupada: mesa.pedidoActivoId !== null,
                          algunoPagadoNoTodos: mesa.algunoPagadoNoTodos,
                          tieneProductos: mesa.tieneProductos,
                          pedidoCreatedAt: mesa.pedidoCreatedAt,
                          alertaActiva,
                          alertaMinutos,
                        },
                        ahora,
                      )}
                      onSelect={() => setSeleccionId(mesa.id)}
                    />
                  ))}
                </div>
              </DndContext>
            </div>

            {mesaSeleccionada && posicionSeleccionada && (
              <div className="rounded-2xl bg-white shadow-card px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold">
                    {mesaSeleccionada.nombre ?? `Mesa ${mesaSeleccionada.numero}`}
                  </p>
                  <button
                    onClick={() => setSeleccionId(null)}
                    className="text-[12px] font-semibold text-text-3 active:opacity-60"
                  >
                    Cerrar
                  </button>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                    Forma
                  </p>
                  <SelectorForma
                    value={posicionSeleccionada.forma}
                    onChange={(forma) => actualizarMesa(mesaSeleccionada.id, { forma })}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                    Tamaño
                  </p>
                  <SelectorTamano
                    value={posicionSeleccionada.tamano}
                    onChange={(tamano) => actualizarMesa(mesaSeleccionada.id, { tamano })}
                  />
                </div>

                <button
                  onClick={() => handleRotar(mesaSeleccionada.id)}
                  className="w-full rounded-lg bg-s2 py-2.5 text-[13px] font-semibold text-text-2 active:opacity-70"
                >
                  ⟳ Rotar 90° ({posicionSeleccionada.rotacion}°)
                </button>
              </div>
            )}

            <button
              onClick={handleGuardar}
              disabled={dirty.size === 0 || guardando || uniendo}
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
  seleccionada,
  anilloColor,
  magnetActivo = false,
  colorEstado = 'verde',
  onSelect,
}: {
  mesa: MesaEditable
  posicion: Posicion
  seleccionada: boolean
  anilloColor?: string
  magnetActivo?: boolean
  colorEstado?: 'verde' | 'naranja' | 'azul' | 'rojo'
  onSelect: () => void
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

  // La propia mesa que se arrastra también se resalta mientras está
  // imantada con otra (no solo la mesa destino) — así el gesto se siente
  // como "las dos se están por unir", no solo "esa otra mesa se resaltó".
  const colorFinal =
    isDragging && magnetActivo ? COLOR_IMAN : seleccionada ? '#2563eb' : anilloColor

  const capacidad = Math.max(mesa.capacidad ?? 1, 1)
  const puntos = calcularPosicionesSillas(capacidad, posicion.forma, posicion.tamano, mesa.asientosHorario)
  const marcadores = puntos.map((p, idx) => ({ ...p, ocupada: idx < mesa.ocupadas }))

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className="absolute cursor-grab touch-none active:cursor-grabbing"
      style={style}
    >
      <MesaShape
        forma={posicion.forma}
        tamano={posicion.tamano}
        rotacion={posicion.rotacion}
        anilloColor={colorFinal}
        colorEstado={colorEstado}
        marcadores={marcadores}
      >
        <span className="text-[12px] font-bold leading-none">{mesa.nombre ?? mesa.numero}</span>
      </MesaShape>
    </div>
  )
}

function SelectorForma({
  value,
  onChange,
}: {
  value: FormaMesa
  onChange: (forma: FormaMesa) => void
}) {
  const opciones: { value: FormaMesa; label: string }[] = [
    { value: 'cuadrado', label: 'Cuadrada' },
    { value: 'rectangulo', label: 'Rectangular' },
    { value: 'circulo', label: 'Circular' },
  ]
  return (
    <div className="flex gap-1.5">
      {opciones.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
            value === o.value ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SelectorTamano({
  value,
  onChange,
}: {
  value: TamanoMesa
  onChange: (tamano: TamanoMesa) => void
}) {
  const opciones: { value: TamanoMesa; label: string }[] = [
    { value: 'chico', label: 'Chico' },
    { value: 'medio', label: 'Medio' },
    { value: 'grande', label: 'Grande' },
  ]
  return (
    <div className="flex gap-1.5">
      {opciones.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
            value === o.value ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
