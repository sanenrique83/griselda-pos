// Tokens de diseño compartidos — referencia central para las 4 reglas
// transversales documentadas en CLAUDE.md ("Reglas de diseño transversal").
// Revisa aquí antes de rediseñar una pantalla.

// ─── Regla 1: dos patrones de ícono, nunca mezclados ───────────────────────
// "accion-con-icono": círculo/cuadrado con tinte de color + etiqueta debajo,
// para acciones contextuales (Compartir, Mover, Cobrar).
// "chip-filtro": píldora de solo texto, sin ícono, para categorías y
// filtros de estado.
export type PatronIcono = 'accion-con-icono' | 'chip-filtro'

// ─── Regla 2: semáforo de mesa ─────────────────────────────────────────────
// La paleta vive en lib/colorMesa.ts (fuente única de verdad) — no la
// dupliques aquí. Los estados de ciclo de vida de un pedido en Historial
// (Cerrada/Abierta/Cancelada) son un sistema visual distinto (píldora con
// ícono, no color sólido de tarjeta); nunca reusar colorMesa.ts para eso.

// ─── Regla 3: montos siempre con decimales ─────────────────────────────────
export function formatCurrency(monto: number): string {
  return `$${monto.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ─── Regla 4: Header A vs. Header B ────────────────────────────────────────
// 'A' (pantallas raíz del bottom nav): logo circular + nombre/marca +
// píldora de turno + campana de notificaciones.
// 'B' (pantallas de detalle): flecha atrás + título + acciones contextuales
// a la derecha.
export type TipoHeader = 'A' | 'B'
