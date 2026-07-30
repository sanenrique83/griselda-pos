export type ModoOrden = 'alfabetico_asc' | 'alfabetico_desc' | 'personalizado'

// 'personalizado' ordena por la columna `orden` (drag-and-drop en Catálogo);
// los modos alfabéticos ignoran esa columna y ordenan por nombre.
export function columnaOrden(modo: ModoOrden | null | undefined): {
  column: 'orden' | 'nombre'
  ascending: boolean
} {
  if (modo === 'alfabetico_asc') return { column: 'nombre', ascending: true }
  if (modo === 'alfabetico_desc') return { column: 'nombre', ascending: false }
  return { column: 'orden', ascending: true }
}
