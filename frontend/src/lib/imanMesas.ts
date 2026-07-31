import { dimensionesMesa } from '@/components/mesas/MesaShape'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

// ─────────────────────────────────────────────────────────────────────────────
// Lógica de arrastre imantado para unir mesas — compartida entre
// /mas/mapa-mesas (LienzoMesasEditor, arrastre libre para reacomodar el
// layout + imantado para unir) y /mesas (PlanoMesas, arrastre que SOLO sirve
// para detectar el imán y disparar la unión; sin imán, la mesa regresa a su
// posición actual). Ambas pantallas comparten esta detección, clasificación
// y geometría de reacomodo — solo difieren en qué hacen con un drop SIN
// imán, que es decisión de cada pantalla, no de este módulo.
// ─────────────────────────────────────────────────────────────────────────────

export const UMBRAL_IMAN_PX = 40 // distancia (entre bordes de las cajas) para "imantar"
export const COLOR_IMAN = '#22c55e'

// Los 3 casos de unión por arrastre, según el estado de ocupación de la mesa
// arrastrada y la candidata más cercana (no importa cuál de las dos se
// arrastró — se decide por ocupación, no por dirección del gesto):
//   - 'ambas_libres'      → ninguna tiene pedido: dispara el picker de silla
//                           combinado (ruta /pos/nueva-combinada).
//   - 'libre_a_ocupada'   → una libre + una con pedido: la libre se registra
//                           como capacidad extra de la cadena (sin picker).
//   - 'ocupada_a_ocupada' → ambas con pedido (distinto): unirMesas().
export type TipoUnionIman = 'ambas_libres' | 'libre_a_ocupada' | 'ocupada_a_ocupada'

// Distancia entre los bordes de dos cajas rectangulares alineadas a los ejes
// (AABB) — 0 si se traslapan. Aproxima "qué tan cerca están de tocarse" sin
// importar si una mesa es chica/grande o si su forma real es circular (para
// efectos de imantado solo interesa la caja contenedora).
export function distanciaEntreCajas(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0)
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0)
  return Math.sqrt(dx * dx + dy * dy)
}

export type CandidatoIman = {
  id: number
  x: number
  y: number
  forma: FormaMesa
  tamano: TamanoMesa
  pedidoActivoId: number | null
}

// Candidato de imantado: mesa más cercana (por borde de caja) que forma uno
// de los 3 casos válidos de unión. Se excluye: la propia mesa arrastrada, y
// dos mesas ya ocupadas por el MISMO pedido (ya están en la misma cadena).
export function buscarCandidatoIman(
  draggedId: number,
  draggedPedidoActivoId: number | null,
  cajaArrastrada: { x: number; y: number; w: number; h: number },
  candidatos: CandidatoIman[],
): { targetId: number; tipo: TipoUnionIman } | null {
  let mejorId: number | null = null
  let mejorDist = Infinity

  for (const mesa of candidatos) {
    if (mesa.id === draggedId) continue
    if (draggedPedidoActivoId && mesa.pedidoActivoId && draggedPedidoActivoId === mesa.pedidoActivoId) {
      continue
    }
    const { width, height } = dimensionesMesa(mesa.forma, mesa.tamano)
    const dist = distanciaEntreCajas(cajaArrastrada, { x: mesa.x, y: mesa.y, w: width, h: height })
    if (dist <= UMBRAL_IMAN_PX && dist < mejorDist) {
      mejorDist = dist
      mejorId = mesa.id
    }
  }
  if (mejorId === null) return null

  const target = candidatos.find((m) => m.id === mejorId)!
  const tipo: TipoUnionIman =
    !draggedPedidoActivoId && !target.pedidoActivoId
      ? 'ambas_libres'
      : draggedPedidoActivoId && target.pedidoActivoId
        ? 'ocupada_a_ocupada'
        : 'libre_a_ocupada'
  return { targetId: mejorId, tipo }
}

// Posición pegada al lado derecho de `basePos` — usada para reacomodar
// visualmente la mesa satélite en los 3 casos, siempre relativa a la mesa
// que se queda fija. `bounds` acota el resultado al lienzo de quien llama
// (900×1100 en /mas/mapa-mesas por defecto; /mesas puede pasar el suyo).
export function posicionAdosada(
  basePos: { x: number; y: number; rotacion: number; forma: FormaMesa; tamano: TamanoMesa },
  bounds: { width: number; height: number } = { width: 900, height: 1100 },
): { x: number; y: number; rotacion: number } {
  const { width } = dimensionesMesa(basePos.forma, basePos.tamano)
  return {
    x: Math.min(Math.max(0, Math.round(basePos.x + width)), bounds.width - 20),
    y: Math.min(Math.max(0, Math.round(basePos.y)), bounds.height - 20),
    rotacion: basePos.rotacion,
  }
}
