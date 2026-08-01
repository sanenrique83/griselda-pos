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
import { crearArea } from '@/app/(app)/mas/catalogo/actions'
import { unirMesas, unirMesaLibreAOcupada } from '@/app/(app)/pos/[pedidoId]/actions'
import { calcularPosicionesSillas } from '@/lib/asientos'
import { colorSemaforoMesa } from '@/lib/colorMesa'
import {
  COLOR_IMAN,
  buscarCandidatoIman as buscarCandidatoImanBase,
  posicionAdosada as posicionAdosadaBase,
  type TipoUnionIman,
  type CandidatoIman,
} from '@/lib/imanMesas'
import { posicionAutoGrid } from '@/lib/autoAcomodoMesas'
import type { MesaEditable, AreaTab } from '@/app/(app)/mas/mapa-mesas/page'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

// Selector de pestaña de área: el id real de una fila de `areas`, o el
// sentinel 'sin_area' para mesas con area_id nulo (ej. "+ Mesa extra" desde
// /mesas, que se crean sin área asignada) — nunca hay una pestaña "todas".
type AreaTabId = number | 'sin_area'

const CANVAS_W = 900
const CANVAS_H = 1100
const CUADRICULA_PX = 20 // tamaño de la cuadrícula de fondo, solo visual

type Posicion = {
  x: number
  y: number
  rotacion: number
  forma: FormaMesa
  tamano: TamanoMesa
}

// Mesas sin pos_x/pos_y (nunca se han colocado en el mapa) se acomodan en
// una cuadrícula temporal (ver lib/autoAcomodoMesas.ts) para que aparezcan
// en el lienzo desde el primer uso — quedan marcadas "sucias" para que
// "Guardar disposición" persista esa posición inicial en vez de perderla al
// recargar. (/mesas usa la misma cuadrícula pero persiste sola, sin esperar
// a que nadie la guarde — ver PlanoMesas.tsx.)
//
// El contador de la cuadrícula es POR ÁREA (una Map por area_id/'sin_area'),
// no global — cada área tiene su propio espacio de coordenadas
// independiente, así que una mesa nueva en el Área 2 nunca choca con el
// layout ya armado del Área 1, aunque ambas reutilicen los mismos (x,y).
function posicionesIniciales(mesas: MesaEditable[]): Record<number, Posicion> {
  const posiciones: Record<number, Posicion> = {}
  const contadorPorArea = new Map<AreaTabId, number>()
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
      const clave: AreaTabId = mesa.areaId ?? 'sin_area'
      const indice = contadorPorArea.get(clave) ?? 0
      posiciones[mesa.id] = {
        ...posicionAutoGrid(indice),
        rotacion: mesa.rotacion,
        forma: mesa.forma,
        tamano: mesa.tamano,
      }
      contadorPorArea.set(clave, indice + 1)
    }
  }
  return posiciones
}

export function LienzoMesasEditor({
  mesas,
  areas,
  alertaActiva,
  alertaMinutos,
}: {
  mesas: MesaEditable[]
  areas: AreaTab[]
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
  // Tipo de unión que dispararía soltar AHORA, según el estado de ocupación
  // de la mesa arrastrada y la candidata más cercana — ver buscarCandidatoIman.
  const [magnetTarget, setMagnetTarget] = useState<{ targetId: number; tipo: TipoUnionIman } | null>(
    null,
  )
  const [uniendo, setUniendo] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())

  // Pestaña de área activa — el lienzo solo muestra/arrastra mesas de esta
  // área. Arranca en la primera área configurada, o "Sin área" si no hay
  // ninguna todavía.
  const [areaSeleccionada, setAreaSeleccionada] = useState<AreaTabId>(
    () => areas[0]?.id ?? 'sin_area',
  )
  const [sheetAreaOpen, setSheetAreaOpen] = useState(false)
  const [nuevaAreaNombre, setNuevaAreaNombre] = useState('')
  const [creandoArea, setCreandoArea] = useState(false)
  const [errorArea, setErrorArea] = useState<string | null>(null)

  function seleccionarArea(id: AreaTabId) {
    setAreaSeleccionada(id)
    setSeleccionId(null)
  }

  function handleCrearArea() {
    const nombre = nuevaAreaNombre.trim()
    if (!nombre) {
      setErrorArea('Ingresa un nombre.')
      return
    }
    setErrorArea(null)
    setCreandoArea(true)
    crearArea(nombre).then((result) => {
      setCreandoArea(false)
      if ('error' in result) {
        setErrorArea(result.error)
        return
      }
      setNuevaAreaNombre('')
      setSheetAreaOpen(false)
      seleccionarArea(result.id)
      router.refresh()
    })
  }

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const mesaPorId = new Map(mesas.map((m) => [m.id, m]))

  // Mesas de la pestaña de área actual — todo lo que se dibuja, arrastra o
  // conecta con líneas en el lienzo sale de aquí, nunca de `mesas` completo.
  const mesasDelArea = mesas.filter((m) =>
    areaSeleccionada === 'sin_area' ? m.areaId === null : m.areaId === areaSeleccionada,
  )

  function actualizarMesa(id: number, patch: Partial<Posicion>) {
    setPosiciones((prev) => {
      const actual = prev[id]
      if (!actual) return prev
      return { ...prev, [id]: { ...actual, ...patch } }
    })
    setDirty((prev) => new Set(prev).add(id))
  }

  // Candidato de imantado: delega la detección/clasificación al módulo
  // compartido con /mesas (ver lib/imanMesas.ts) — aquí solo se arma la caja
  // en vivo del arrastre y la lista de candidatos a partir del estado propio
  // de este editor (posiciones, que en /mas/mapa-mesas sí es editable).
  function buscarCandidatoIman(
    draggedId: number,
    liveX: number,
    liveY: number,
  ): { targetId: number; tipo: TipoUnionIman } | null {
    const draggedMesa = mesaPorId.get(draggedId)
    const draggedPos = posiciones[draggedId]
    if (!draggedMesa || !draggedPos) return null
    const { width: w, height: h } = dimensionesMesa(draggedPos.forma, draggedPos.tamano)
    const cajaArrastrada = { x: liveX, y: liveY, w, h }

    const candidatos: CandidatoIman[] = mesasDelArea
      .map((mesa) => {
        const pos = posiciones[mesa.id]
        if (!pos) return null
        return {
          id: mesa.id,
          x: pos.x,
          y: pos.y,
          forma: pos.forma,
          tamano: pos.tamano,
          pedidoActivoId: mesa.pedidoActivoId,
        }
      })
      .filter((c): c is CandidatoIman => c !== null)

    return buscarCandidatoImanBase(draggedId, draggedMesa.pedidoActivoId, cajaArrastrada, candidatos)
  }

  function handleDragMove(event: DragMoveEvent) {
    const id = Number(event.active.id)
    const actual = posiciones[id]
    if (!actual) return
    const liveX = actual.x + event.delta.x
    const liveY = actual.y + event.delta.y
    setMagnetTarget(buscarCandidatoIman(id, liveX, liveY))
  }

  // Posición pegada al lado derecho de `basePos` — reacomodo visual de la
  // mesa satélite en los 3 casos (ver lib/imanMesas.ts), acotado al lienzo
  // de este editor (900×1100).
  function posicionAdosada(basePos: Posicion): { x: number; y: number; rotacion: number } {
    return posicionAdosadaBase(basePos, { width: CANVAS_W, height: CANVAS_H })
  }

  function handleDragEnd(event: DragEndEvent) {
    const id = Number(event.active.id)
    const { delta } = event
    const magnet = magnetTarget
    setMagnetTarget(null)
    if (delta.x === 0 && delta.y === 0 && magnet === null) return

    const actual = posiciones[id]
    if (!actual) return
    const x = Math.min(Math.max(0, Math.round(actual.x + delta.x)), CANVAS_W - 20)
    const y = Math.min(Math.max(0, Math.round(actual.y + delta.y)), CANVAS_H - 20)

    if (magnet !== null) {
      const { targetId, tipo } = magnet
      const draggedMesa = mesaPorId.get(id)
      const targetMesa = mesaPorId.get(targetId)
      const targetPos = posiciones[targetId]

      if (tipo === 'ocupada_a_ocupada' && draggedMesa?.pedidoActivoId && targetMesa?.pedidoActivoId && targetPos) {
        setUniendo(true)
        setMensaje(null)
        const reposicion = draggedMesa.temporal
          ? null
          : { mesaId: id, ...posicionAdosada(targetPos) }
        unirMesas(draggedMesa.pedidoActivoId, targetMesa.pedidoActivoId, reposicion).then((result) => {
          setUniendo(false)
          if (result?.error) {
            setMensaje({ tipo: 'error', texto: result.error })
            actualizarMesa(id, { x, y })
            return
          }
          // Efecto visual: acomoda la mesa arrastrada tocando a la
          // principal — no afecta el cálculo de sillas (eso usa el orden
          // guardado en pedido_mesas, no la posición en el mapa). Si es
          // normal (no temporal) ya quedó persistido en BD por unirMesas(),
          // así que se saca de "dirty" para no pedir guardar de nuevo.
          if (reposicion) {
            actualizarMesa(id, { x: reposicion.x, y: reposicion.y, rotacion: reposicion.rotacion })
            setDirty((prev) => {
              const s = new Set(prev)
              s.delete(id)
              return s
            })
          } else {
            actualizarMesa(id, { x, y })
          }
          setMensaje({ tipo: 'ok', texto: `${draggedMesa.nombre ?? draggedMesa.numero} unida.` })
          router.refresh()
        })
        return
      }

      if (tipo === 'libre_a_ocupada' && draggedMesa && targetMesa && targetPos) {
        // No importa cuál de las dos se arrastró: la que ya tiene pedido es
        // siempre la principal (nunca se mueve por la unión); la libre se
        // registra como capacidad extra y es la que se reacomoda.
        const draggedEsLibre = !draggedMesa.pedidoActivoId
        const libreId = draggedEsLibre ? id : targetId
        const libreMesa = draggedEsLibre ? draggedMesa : targetMesa
        const ocupadaMesa = draggedEsLibre ? targetMesa : draggedMesa
        const pedidoDestinoId = ocupadaMesa.pedidoActivoId!
        // Posición de la ocupada tras este drag: si es la que se arrastró,
        // ya tiene su nueva posición (x,y de arriba); si es el objetivo (no
        // se arrastró), se queda donde estaba.
        const ocupadaPos: Posicion = draggedEsLibre
          ? targetPos
          : { ...actual, x, y }

        setUniendo(true)
        setMensaje(null)
        const reposicion = libreMesa.temporal ? null : posicionAdosada(ocupadaPos)
        unirMesaLibreAOcupada(libreId, pedidoDestinoId, reposicion).then((result) => {
          setUniendo(false)
          if (result?.error) {
            setMensaje({ tipo: 'error', texto: result.error })
            actualizarMesa(id, { x, y })
            return
          }
          // La mesa ocupada (si fue la arrastrada) toma su posición normal
          // de drop; la libre (arrastrada o no) se reacomoda pegada a ella.
          if (!draggedEsLibre) actualizarMesa(id, { x, y })
          if (reposicion) {
            actualizarMesa(libreId, reposicion)
            setDirty((prev) => {
              const s = new Set(prev)
              s.delete(libreId)
              return s
            })
          } else if (draggedEsLibre) {
            actualizarMesa(id, { x, y })
          }
          setMensaje({
            tipo: 'ok',
            texto: `${libreMesa.nombre ?? libreMesa.numero} añadida a ${ocupadaMesa.nombre ?? ocupadaMesa.numero}.`,
          })
          router.refresh()
        })
        return
      }

      if (tipo === 'ambas_libres' && draggedMesa && targetMesa && targetPos) {
        // Ninguna de las dos tiene pedido: hace falta elegir silla para el
        // comensal 1 con la capacidad combinada — no se puede resolver aquí
        // mismo, se navega al picker (mesa objetivo = principal, se queda
        // fija; mesa arrastrada = satélite, orden 2, se reposiciona al
        // confirmar). No hay nada que persistir todavía en este punto.
        const repo = posicionAdosada(targetPos)
        router.push(
          `/pos/nueva-combinada/${targetId}/${id}?x=${repo.x}&y=${repo.y}&r=${repo.rotacion}`,
        )
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
  // mientras se edita. Acotado a la pestaña de área actual: si una cadena
  // cruzara áreas (caso raro), la mesa que no está en esta pestaña
  // simplemente no dibuja su tramo de línea.
  const gruposMap = new Map<number, MesaEditable[]>()
  for (const mesa of mesasDelArea) {
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

  const mesaSeleccionada = seleccionId !== null ? mesasDelArea.find((m) => m.id === seleccionId) : undefined
  const posicionSeleccionada = seleccionId !== null ? posiciones[seleccionId] : undefined

  return (
    <div className="min-h-full bg-s2">
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-0">
        <BotonRegresarMas />
        <h1 className="mt-1 text-[20px] font-bold leading-tight pb-3">Mapa de mesas</h1>
        <p className="pb-3 text-[13px] text-text-3">
          Arrastra cada mesa a su lugar · tócala para editar forma, tamaño y rotación
        </p>

        {/* Pestañas de área — una por fila de `areas`, más "Sin área" y
            "+ Nueva área" (crea directo desde aquí, sin ir a Catálogo). */}
        <div className="flex overflow-x-auto scrollbar-none">
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => seleccionarArea(a.id)}
              className={`flex-shrink-0 px-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors mr-4 ${
                areaSeleccionada === a.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-text-3'
              }`}
            >
              {a.nombre}
            </button>
          ))}
          <button
            onClick={() => seleccionarArea('sin_area')}
            className={`flex-shrink-0 px-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors mr-4 ${
              areaSeleccionada === 'sin_area'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-text-3'
            }`}
          >
            Sin área
          </button>
          <button
            onClick={() => setSheetAreaOpen(true)}
            className="flex-shrink-0 px-1 py-2.5 text-[13px] font-semibold text-blue-600"
          >
            + Nueva área
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {mesas.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-card px-4 py-8 text-center">
            <p className="text-sm text-text-3">
              No hay mesas activas. Agrégalas desde Más → Catálogo.
            </p>
          </div>
        ) : mesasDelArea.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-card px-4 py-8 text-center">
            <p className="text-sm text-text-3">No hay mesas en esta área.</p>
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

                  {mesasDelArea.map((mesa) => (
                    <MesaDraggable
                      key={mesa.id}
                      mesa={mesa}
                      posicion={posiciones[mesa.id]}
                      seleccionada={seleccionId === mesa.id}
                      anilloColor={
                        mesa.id === magnetTarget?.targetId ? COLOR_IMAN : colorPorMesa.get(mesa.id)
                      }
                      magnetActivo={magnetTarget !== null}
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

      {/* Sheet Nueva área */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          sheetAreaOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => {
          if (creandoArea) return
          setSheetAreaOpen(false)
          setErrorArea(null)
        }}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          sheetAreaOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Nueva área</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Nombre</p>
          <input
            type="text"
            value={nuevaAreaNombre}
            onChange={(e) => setNuevaAreaNombre(e.target.value)}
            placeholder="Ej. Terraza"
            className="w-full rounded-xl border-[1.5px] border-[#D1D1D6] px-4 py-3 text-[16px] font-semibold"
          />
          {errorArea && (
            <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{errorArea}</p>
          )}
        </div>
        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5 space-y-2">
          <button
            onClick={handleCrearArea}
            disabled={creandoArea}
            className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
          >
            {creandoArea ? 'Creando…' : 'Crear área'}
          </button>
          <button
            onClick={() => {
              setSheetAreaOpen(false)
              setErrorArea(null)
            }}
            className="w-full rounded-xl bg-s2 py-[14px] text-sm font-semibold text-text-2 active:scale-[.98]"
          >
            Cancelar
          </button>
        </div>
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
