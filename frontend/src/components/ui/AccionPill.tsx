import type { LucideIcon } from 'lucide-react'

// "Acción con ícono" (regla de diseño transversal #1, CLAUDE.md), variante
// horizontal en píldora — para filas de acciones contextuales de una sola
// línea bajo un Header B (ej. Compartir/Mover/Reasignar en Comanda), a
// diferencia de AccionIcono.tsx (círculo grande + etiqueta ABAJO, pensado
// para una grilla de accesos rápidos tipo Mesas). Sigue siendo el patrón
// "ícono + etiqueta" — nunca confundir con el "chip de filtro" (solo texto,
// sin ícono).
interface AccionPillProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}

export function AccionPill({ icon: Icon, label, onClick, disabled }: AccionPillProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#173F2E]/20 bg-white px-3.5 py-2 text-[13px] font-semibold text-[#173F2E] active:scale-[.97] active:bg-[#173F2E]/5 disabled:opacity-40"
    >
      <Icon size={15} strokeWidth={2.2} />
      {label}
    </button>
  )
}
