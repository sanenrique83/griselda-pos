// Auto-acomodo en cuadrícula para mesas sin pos_x/pos_y (nunca se han
// colocado en un mapa) — compartido entre /mas/mapa-mesas
// (LienzoMesasEditor, donde el usuario todavía puede reacomodarlas y las
// guarda a mano con "Guardar disposición") y /mesas (PlanoMesas, donde la
// posición calculada aquí se persiste sola en cuanto aparece, sin esperar a
// que nadie la guarde — ver ese componente).
export const PASO_AUTO = 90 // separación entre columnas/filas de la cuadrícula
export const COLUMNAS_AUTO = 6

// Posición de la mesa en el índice `indice` (0-based) DENTRO del subconjunto
// de mesas sin posición — no del arreglo completo. El llamador decide ese
// índice (típicamente su orden de aparición entre las mesas sin posición).
export function posicionAutoGrid(indice: number): { x: number; y: number } {
  const col = indice % COLUMNAS_AUTO
  const fila = Math.floor(indice / COLUMNAS_AUTO)
  return { x: 30 + col * PASO_AUTO, y: 30 + fila * PASO_AUTO }
}
