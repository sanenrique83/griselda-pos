// Tokens de diseño compartidos — referencia central para las 4 reglas
// transversales documentadas en CLAUDE.md ("Reglas de diseño transversal").
// Revisa aquí antes de rediseñar una pantalla.

// ─── Color de marca ─────────────────────────────────────────────────────────
// Verde bosque — decidido (no muestreado de mockup). Úsalo para header tipo A
// y acciones primarias de marca. NUNCA para el semáforo de mesa: colorMesa.ts
// es un sistema de color aparte, con significado operativo propio
// (libre/ocupada/etc.) — no se mezcla con el verde de marca aunque ambos
// sean "verde".
export const brand = {
  forest: '#173F2E',
  forestHover: '#0F2E21',
} as const

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

// ─── Tamaños de texto semánticos ───────────────────────────────────────────
// Fundación de consistencia visual — clases listas para spread directo en
// className. `etiqueta`/`caption` usan text-3/text-4 (paleta iOS ya
// establecida en tailwind.config.ts) como el gris más cercano a lo pedido
// (gray-500/gray-400 de Tailwind por defecto no está en uso en este
// proyecto; usar esa escala aparte introduciría un segundo sistema de gris).
export const texto = {
  tituloPantalla: 'text-[20px] font-bold text-text',
  encabezadoSeccion: 'text-[17px] font-semibold text-text',
  cuerpo: 'text-[15px] text-text',
  etiqueta: 'text-[13px] text-text-3',
  caption: 'text-[11px] text-text-4',
} as const

// ─── Espaciado ──────────────────────────────────────────────────────────────
// Los 3 patrones ya seguidos de facto por Tarjeta.tsx/Sheet.tsx — nombrados
// aquí para que el próximo componente los use por referencia, no por copiar
// un valor suelto de otro archivo.
export const espaciado = {
  fila: 'px-4 py-3',
  tarjeta: 'px-4 py-4',
  sheet: 'px-5 py-4',
} as const
