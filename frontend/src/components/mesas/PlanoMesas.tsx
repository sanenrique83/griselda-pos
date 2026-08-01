'use client'

import { useEffect, useRef, useState } from 'react'
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
import { MesaShape, dimensionesMesa, colorParaGrupo } from './MesaShape'
import { TiempoMesa } from './TiempoMesa'
import { calcularPosicionesSillas } from '@/lib/asientos'
import { colorSemaforoMesa, ESTILO_COLOR_MESA } from '@/lib/colorMesa'
import { unirMesas, unirMesaLibreAOcupada } from '@/app/(app)/pos/[pedidoId]/actions'
import { guardarDisposicion } from '@/app/(app)/mas/mapa-mesas/actions'
import {
  COLOR_IMAN,
  buscarCandidatoIman,
  posicionAdosada,
  type TipoUnionIman,
  type CandidatoIman,
} from '@/lib/imanMesas'
import { posicionAutoGrid, calcularYInicioAutoGrid } from '@/lib/autoAcomodoMesas'
import type { MesaUI } from '@/app/(app)/mesas/page'

const MARGEN = 100

/**
 * Plano para la pantalla `/mesas` del POS — misma disposición configurada en
 * `/mas/mapa-mesas`, pero de tocar-para-abrir en vez de reacomodar el
 * layout. El arrastre existe SOLO para detectar el imán y disparar la unión
 * (mismos 3 casos, mismas acciones de backend que /mas/mapa-mesas — ver
 * lib/imanMesas.ts): si se suelta sin estar imantado, la mesa regresa a su
 * posición actual — esta pantalla nunca reposiciona el plano a mano, eso
 * sigue siendo exclusivo del editor de admin.
 *
 * Mesas sin pos_x/pos_y (recién creadas, ej. "+ Mesa extra") se auto-acomodan
 * en la misma cuadrícula que usa LienzoMesasEditor (ver lib/autoAcomodoMesas)
 * para aparecer arrastrables desde el primer momento — a diferencia del
 * editor de admin, aquí esa posición se persiste sola en segundo plano (sin
 * pedirle nada al usuario) apenas se calcula, así que la próxima vez ya es
 * su posición real en BD.
 */
export function PlanoMesas({
  mesas,
  onMesaClick,
  onUnionError,
  ahora,
  alertaActiva,
  alertaMinutos,
  tiempoMesaAlertaMinutos,
}: {
  mesas: MesaUI[]
  onMesaClick: (mesa: MesaUI) => void
  onUnionError?: (mensaje: string) => void
  ahora: number
  alertaActiva: boolean
  alertaMinutos: number
  tiempoMesaAlertaMinutos: number
}) {
  const router = useRouter()
  const [magnetTarget, setMagnetTarget] = useState<{ targetId: number; tipo: TipoUnionIman } | null>(
    null,
  )
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  // Posición EFECTIVA de cada mesa: la real (pos_x/pos_y) si ya la tiene, o
  // la calculada por auto-acomodo si no — todas las mesas terminan con una,
  // así que ya no hace falta una lista aparte de "sin posición". La
  // cuadrícula arranca debajo de las mesas reales de este mismo conjunto
  // (`mesas` ya viene filtrado por área desde MesasShell cuando hay más de
  // una) — nunca en (30,30) fijo, que podía caer encima de una mesa real ya
  // cercana al origen (ver lib/autoAcomodoMesas.ts).
  const sinPosicion = mesas.filter((m) => m.pos_x === null || m.pos_y === null)
  const yInicioAuto = calcularYInicioAutoGrid(
    mesas
      .filter((m) => m.pos_x !== null && m.pos_y !== null)
      .map((m) => ({ y: m.pos_y!, forma: m.forma, tamano: m.tamano })),
  )
  const autoPosPorId = new Map<number, { x: number; y: number }>()
  sinPosicion.forEach((m, idx) => autoPosPorId.set(m.id, posicionAutoGrid(idx, yInicioAuto)))

  function posEfectiva(mesa: MesaUI): { x: number; y: number } {
    if (mesa.pos_x !== null && mesa.pos_y !== null) return { x: mesa.pos_x, y: mesa.pos_y }
    return autoPosPorId.get(mesa.id)!
  }

  // Persistir en segundo plano la posición recién calculada para mesas sin
  // posición — silencioso (sin mensaje de éxito ni bloquear nada): la mesa
  // ya se ve y se puede arrastrar de inmediato con la posición calculada,
  // esto solo hace que esa misma posición quede real en BD para la próxima
  // vez. `guardadasRef` evita reintentar una mesa ya enviada mientras
  // esperamos la respuesta (o el revalidate que trae pos_x/pos_y reales).
  const guardadasRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const pendientes = sinPosicion.filter((m) => !guardadasRef.current.has(m.id))
    if (pendientes.length === 0) return

    const cambios = pendientes.map((m) => {
      guardadasRef.current.add(m.id)
      const pos = autoPosPorId.get(m.id)!
      return { id: m.id, posX: pos.x, posY: pos.y, rotacion: m.rotacion, forma: m.forma, tamano: m.tamano }
    })

    guardarDisposicion(cambios).then((res) => {
      if ('error' in res) {
        console.error('[PlanoMesas] error al auto-guardar posición de mesas nuevas:', {
          mesaIds: cambios.map((c) => c.id),
          error: res.error,
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesas])

  const maxX = Math.max(400, ...mesas.map((m) => posEfectiva(m).x + MARGEN))
  const maxY = Math.max(300, ...mesas.map((m) => posEfectiva(m).y + MARGEN))

  const mesaPorId = new Map(mesas.map((m) => [m.id, m]))

  // Mesas unidas (mismo pedido_activo.id, vía unirMesas persistente) — solo
  // interesa para el conector cuando el grupo tiene 2 o más mesas.
  const gruposMap = new Map<number, MesaUI[]>()
  for (const mesa of mesas) {
    if (!mesa.pedido_activo) continue
    const arr = gruposMap.get(mesa.pedido_activo.id) ?? []
    arr.push(mesa)
    gruposMap.set(mesa.pedido_activo.id, arr)
  }
  const grupos = [...gruposMap.entries()]
    .filter(([, ms]) => ms.length >= 2)
    .sort((a, b) => a[0] - b[0])

  const colorPorMesa = new Map<number, string>()
  const lineas: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []

  grupos.forEach(([, ms], idx) => {
    const color = colorParaGrupo(idx)
    const ordenadas = [...ms].sort((a, b) => a.id - b.id)
    const centros = ordenadas.map((m) => {
      const { width, height } = dimensionesMesa(m.forma, m.tamano)
      const pos = posEfectiva(m)
      colorPorMesa.set(m.id, color)
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

  function handleDragMove(event: DragMoveEvent) {
    const id = Number(event.active.id)
    const mesa = mesaPorId.get(id)
    if (!mesa) return
    const pos = posEfectiva(mesa)
    const { width, height } = dimensionesMesa(mesa.forma, mesa.tamano)
    const cajaArrastrada = {
      x: pos.x + event.delta.x,
      y: pos.y + event.delta.y,
      w: width,
      h: height,
    }
    const candidatos: CandidatoIman[] = mesas.map((m) => {
      const p = posEfectiva(m)
      return {
        id: m.id,
        x: p.x,
        y: p.y,
        forma: m.forma,
        tamano: m.tamano,
        pedidoActivoId: m.pedido_activo?.id ?? null,
      }
    })
    setMagnetTarget(
      buscarCandidatoIman(id, mesa.pedido_activo?.id ?? null, cajaArrastrada, candidatos),
    )
  }

  function handleDragStart(event: { active: { id: string | number } }) {
    setDraggingId(Number(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const id = Number(event.active.id)
    const magnet = magnetTarget
    setMagnetTarget(null)
    setDraggingId(null)
    if (magnet === null) return // sin imán: no se persiste nada, la mesa regresa a su lugar

    const draggedMesa = mesaPorId.get(id)
    const targetMesa = mesaPorId.get(magnet.targetId)
    if (!draggedMesa || !targetMesa) return

    const draggedPos = posEfectiva(draggedMesa)
    const targetPos = posEfectiva(targetMesa)
    const bounds = { width: maxX, height: maxY }

    if (magnet.tipo === 'ocupada_a_ocupada' && draggedMesa.pedido_activo && targetMesa.pedido_activo) {
      const reposicion = {
        mesaId: id,
        ...posicionAdosada(
          { x: targetPos.x, y: targetPos.y, rotacion: targetMesa.rotacion, forma: targetMesa.forma, tamano: targetMesa.tamano },
          bounds,
        ),
      }
      unirMesas(draggedMesa.pedido_activo.id, targetMesa.pedido_activo.id, reposicion).then((result) => {
        if (result?.error) {
          onUnionError?.(result.error)
          return
        }
        router.refresh()
      })
      return
    }

    if (magnet.tipo === 'libre_a_ocupada') {
      const draggedEsLibre = !draggedMesa.pedido_activo
      const libreId = draggedEsLibre ? id : magnet.targetId
      const ocupadaMesa = draggedEsLibre ? targetMesa : draggedMesa
      const pedidoDestinoId = ocupadaMesa.pedido_activo?.id
      if (!pedidoDestinoId) return

      // Posición de la ocupada tras este drag: si es la que se arrastró, ya
      // tiene su nueva posición (delta del evento); si es el objetivo (no se
      // arrastró), se queda donde estaba — igual que en /mas/mapa-mesas.
      const ocupadaPos = draggedEsLibre
        ? { x: targetPos.x, y: targetPos.y, rotacion: targetMesa.rotacion, forma: targetMesa.forma, tamano: targetMesa.tamano }
        : {
            x: draggedPos.x + event.delta.x,
            y: draggedPos.y + event.delta.y,
            rotacion: draggedMesa.rotacion,
            forma: draggedMesa.forma,
            tamano: draggedMesa.tamano,
          }

      const reposicion = posicionAdosada(ocupadaPos, bounds)
      unirMesaLibreAOcupada(libreId, pedidoDestinoId, reposicion).then((result) => {
        if (result?.error) {
          onUnionError?.(result.error)
          return
        }
        router.refresh()
      })
      return
    }

    if (magnet.tipo === 'ambas_libres') {
      const repo = posicionAdosada(
        { x: targetPos.x, y: targetPos.y, rotacion: targetMesa.rotacion, forma: targetMesa.forma, tamano: targetMesa.tamano },
        bounds,
      )
      router.push(`/pos/nueva-combinada/${magnet.targetId}/${id}?x=${repo.x}&y=${repo.y}&r=${repo.rotacion}`)
    }
  }

  return (
    <div>
      <div className="overflow-auto px-3 pt-3">
        <div className="relative" style={{ width: maxX, height: maxY }}>
          {lineas.length > 0 && (
            <svg className="pointer-events-none absolute inset-0" width={maxX} height={maxY}>
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

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            {mesas.map((mesa) => {
              const color = colorSemaforoMesa(
                {
                  ocupada: mesa.pedido_activo !== null,
                  algunoPagadoNoTodos: mesa.pedido_activo?.algunoPagadoNoTodos ?? false,
                  tieneProductos: mesa.pedido_activo?.tieneProductos ?? false,
                  pedidoCreatedAt: mesa.pedido_activo?.created_at ?? null,
                  alertaActiva,
                  alertaMinutos,
                },
                ahora,
              )
              const capacidad = Math.max(mesa.capacidad ?? 1, 1)
              const puntos = calcularPosicionesSillas(capacidad, mesa.forma, mesa.tamano, mesa.asientos_horario)
              const marcadores = puntos.map((p, idx) => ({ ...p, ocupada: idx < mesa.ocupadas }))
              const esImantada = mesa.id === magnetTarget?.targetId
              const esArrastrada = mesa.id === draggingId

              return (
                <MesaArrastrable
                  key={mesa.id}
                  mesa={mesa}
                  posicion={posEfectiva(mesa)}
                  onClick={() => onMesaClick(mesa)}
                  anilloColor={
                    esImantada || (esArrastrada && magnetTarget !== null) ? COLOR_IMAN : colorPorMesa.get(mesa.id)
                  }
                  colorEstado={color}
                  marcadores={marcadores}
                  tiempoMesaAlertaMinutos={tiempoMesaAlertaMinutos}
                />
              )
            })}
          </DndContext>
        </div>
      </div>
    </div>
  )
}

function MesaArrastrable({
  mesa,
  posicion,
  onClick,
  anilloColor,
  colorEstado,
  marcadores,
  tiempoMesaAlertaMinutos,
}: {
  mesa: MesaUI
  posicion: { x: number; y: number }
  onClick: () => void
  anilloColor?: string
  colorEstado: ReturnType<typeof colorSemaforoMesa>
  marcadores: { x: number; y: number; anguloDeg: number; ocupada: boolean }[]
  tiempoMesaAlertaMinutos: number
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
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="absolute touch-none active:scale-[.96] transition-transform"
      style={style}
    >
      <MesaShape
        forma={mesa.forma}
        tamano={mesa.tamano}
        rotacion={mesa.rotacion}
        colorEstado={colorEstado}
        anilloColor={anilloColor}
        marcadores={marcadores}
      >
        <span className="text-[13px] font-bold leading-none">
          {mesa.nombre ?? mesa.numero}
        </span>
        {mesa.pedido_activo && (
          <>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ESTILO_COLOR_MESA[colorEstado].dot }}
            />
            <TiempoMesa
              desde={mesa.pedido_activo.created_at}
              umbralMinutos={tiempoMesaAlertaMinutos}
              className="text-[9px] leading-none"
            />
          </>
        )}
      </MesaShape>
    </button>
  )
}
