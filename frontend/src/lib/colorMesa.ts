// Semáforo de color de una mesa — un solo lugar para decidir el color, para
// que /mesas (POS) y /mas/mapa-mesas (admin) nunca se desincronicen.
//
// Prioridad si hay empate: azul > rojo > naranja > verde (ej. un pedido con
// cobro parcial Y comanda vacía por tiempo se ve azul, no rojo).
// 'gris' = fuera de servicio — no es parte del semáforo de ocupación (no
// mide atención/urgencia), pero comparte el mismo mecanismo de color+estilo
// por conveniencia, ya que MesaShape/TarjetaMesa ya están armados alrededor
// de un único `colorEstado`. Tiene prioridad sobre cualquier otro color.
export type ColorMesa = 'verde' | 'naranja' | 'azul' | 'rojo' | 'gris'

export type OcupacionMesa = {
  ocupada: boolean
  algunoPagadoNoTodos: boolean
  tieneProductos: boolean
  pedidoCreatedAt: string | null
  alertaActiva: boolean
  alertaMinutos: number
  fueraDeServicio?: boolean
}

export function colorSemaforoMesa(m: OcupacionMesa, ahoraMs: number = Date.now()): ColorMesa {
  if (m.fueraDeServicio) return 'gris'
  if (!m.ocupada) return 'verde'
  if (m.algunoPagadoNoTodos) return 'azul'
  if (m.alertaActiva && !m.tieneProductos && m.pedidoCreatedAt) {
    const minutosTranscurridos = (ahoraMs - new Date(m.pedidoCreatedAt).getTime()) / 60_000
    if (minutosTranscurridos >= m.alertaMinutos) return 'rojo'
  }
  return 'naranja'
}

export const ESTILO_COLOR_MESA: Record<ColorMesa, { border: string; bg: string; dot: string }> = {
  verde:   { border: '#BBF7D0', bg: '#F0FDF4', dot: '#22c55e' },
  naranja: { border: '#FDE68A', bg: '#FFFDF0', dot: '#f59e0b' },
  azul:    { border: '#BFDBFE', bg: '#EFF6FF', dot: '#2563eb' },
  rojo:    { border: '#FCA5A5', bg: '#FEF2F2', dot: '#dc2626' },
  gris:    { border: '#D1D5DB', bg: '#F3F4F6', dot: '#9CA3AF' },
}
