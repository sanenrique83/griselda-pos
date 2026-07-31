'use client'

import { MesaShape, dimensionesMesa, colorParaGrupo } from './MesaShape'
import { TarjetaMesa } from './TarjetaMesa'
import { calcularPosicionesSillas } from '@/lib/asientos'
import { colorSemaforoMesa, ESTILO_COLOR_MESA } from '@/lib/colorMesa'
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
  ahora,
  alertaActiva,
  alertaMinutos,
}: {
  mesas: MesaUI[]
  onMesaClick: (mesa: MesaUI) => void
  ahora: number
  alertaActiva: boolean
  alertaMinutos: number
}) {
  const posicionadas = mesas.filter((m) => m.pos_x !== null && m.pos_y !== null)
  const sinPosicion = mesas.filter((m) => m.pos_x === null || m.pos_y === null)

  const maxX = Math.max(400, ...posicionadas.map((m) => m.pos_x! + MARGEN))
  const maxY = Math.max(300, ...posicionadas.map((m) => m.pos_y! + MARGEN))

  // Mesas unidas (mismo pedido_activo.id, vía unirMesas persistente) — solo
  // interesa para el conector cuando el grupo tiene 2 o más mesas.
  const gruposMap = new Map<number, MesaUI[]>()
  for (const mesa of posicionadas) {
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
      colorPorMesa.set(m.id, color)
      return { x: m.pos_x! + width / 2, y: m.pos_y! + height / 2 }
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

          {posicionadas.map((mesa) => {
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

            return (
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
                  colorEstado={color}
                  anilloColor={colorPorMesa.get(mesa.id)}
                  marcadores={marcadores}
                >
                  <span className="text-[13px] font-bold leading-none">
                    {mesa.nombre ?? mesa.numero}
                  </span>
                  {mesa.pedido_activo && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ESTILO_COLOR_MESA[color].dot }}
                    />
                  )}
                </MesaShape>
              </button>
            )
          })}
        </div>
      </div>

      {sinPosicion.length > 0 && (
        <div className="px-3 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-text-3">
            Sin posición en el mapa
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {sinPosicion.map((mesa) => (
              <TarjetaMesa
                key={mesa.id}
                mesa={mesa}
                onClick={() => onMesaClick(mesa)}
                isPending={false}
                alertaActiva={alertaActiva}
                alertaMinutos={alertaMinutos}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
