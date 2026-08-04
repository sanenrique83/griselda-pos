export type ModoOrden = 'alfabetico_asc' | 'alfabetico_desc' | 'personalizado'

// Solo aplica a config_sistema.orden_modificadores (nunca a orden_productos):
// ordena las opciones por veces elegidas en los últimos N días, calculado
// aparte vía RPC (ver ordenarPorPopularidad en pos/[pedidoId]/actions.ts) —
// no una columna real, así que columnaOrden() la trata como 'personalizado'
// (mismo fallback que usa el editor de Catálogo, que ignora la popularidad).
export type ModoOrdenModificadores = ModoOrden | 'popularidad'

// 'personalizado' ordena por la columna `orden` (drag-and-drop en Catálogo);
// los modos alfabéticos ignoran esa columna y ordenan por nombre.
export function columnaOrden(modo: ModoOrdenModificadores | null | undefined): {
  column: 'orden' | 'nombre'
  ascending: boolean
} {
  if (modo === 'alfabetico_asc') return { column: 'nombre', ascending: true }
  if (modo === 'alfabetico_desc') return { column: 'nombre', ascending: false }
  return { column: 'orden', ascending: true }
}
