import { dimensionesMesa } from '@/components/mesas/MesaShape'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

// Auto-acomodo en cuadrícula para mesas sin pos_x/pos_y (nunca se han
// colocado en un mapa) — compartido entre /mas/mapa-mesas
// (LienzoMesasEditor, donde el usuario todavía puede reacomodarlas y las
// guarda a mano con "Guardar disposición") y /mesas (PlanoMesas, donde la
// posición calculada aquí se persiste sola en cuanto aparece, sin esperar a
// que nadie la guarde — ver ese componente).
export const PASO_AUTO = 90 // separación entre columnas/filas de la cuadrícula
export const COLUMNAS_AUTO = 6
const MARGEN_DEBAJO_DE_REALES = 30 // mismo margen que ya usaba el origen fijo (30,30)

// Punto de partida vertical de la cuadrícula DENTRO de un área: si esa área
// ya tiene mesas con posición real, arranca justo debajo del borde inferior
// de la más baja (+ margen) — nunca en (30,30) fijo si ya hay algo real ahí.
//
// Bug que corrige esto (reportado por Rober): con origen fijo, una mesa
// nueva ("Extra 1") caía directo encima de una mesa real ("Mesa 1") que ya
// estuviera cerca de (30,30) en esa misma área — el contador por área evita
// que dos mesas AUTO-acomodadas choquen entre sí, pero no evitaba que una
// auto-acomodada chocara con una real ya existente. Si el área no tiene
// ninguna mesa real todavía, el origen sigue siendo 30 (mismo
// comportamiento de siempre para una área nueva/vacía).
//
// Se usa el borde inferior de TODAS las reales del área (no solo su y) para
// que la cuadrícula completa arranque despejada sin importar en qué columna
// esté cada una — más simple y más robusto que acotar también por x.
export function calcularYInicioAutoGrid(
  mesasReales: { y: number; forma: FormaMesa; tamano: TamanoMesa }[],
): number {
  if (mesasReales.length === 0) return 30
  const bordesInferiores = mesasReales.map((m) => m.y + dimensionesMesa(m.forma, m.tamano).height)
  return Math.max(...bordesInferiores) + MARGEN_DEBAJO_DE_REALES
}

// Posición de la mesa en el índice `indice` (0-based) DENTRO del subconjunto
// de mesas sin posición de su área — no del arreglo completo. El llamador
// decide ese índice (típicamente su orden de aparición entre las mesas sin
// posición de esa misma área) y `yInicio` (ver calcularYInicioAutoGrid).
export function posicionAutoGrid(indice: number, yInicio: number = 30): { x: number; y: number } {
  const col = indice % COLUMNAS_AUTO
  const fila = Math.floor(indice / COLUMNAS_AUTO)
  return { x: 30 + col * PASO_AUTO, y: yInicio + fila * PASO_AUTO }
}
