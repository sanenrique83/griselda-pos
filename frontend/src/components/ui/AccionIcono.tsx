import type { LucideIcon } from 'lucide-react'

// "Acción con ícono" (regla de diseño transversal #1, CLAUDE.md): círculo/
// cuadrado con tinte de color + etiqueta debajo, para acciones contextuales
// (Compartir, Mover, Cobrar, Venta rápida, …). Nunca mezclar con el patrón
// "chip de filtro" (píldora de solo texto, sin ícono).
//
// `variant="primaria"` es el caso especial de la acción principal de una
// pantalla (ej. "Nueva orden para llevar" en /mesas): fondo sólido de marca
// en vez de círculo con tinte, para distinguirla visualmente del resto.
interface AccionIconoProps {
  icon: LucideIcon
  label: string
  sublabel?: string
  onClick: () => void
  disabled?: boolean
  variant?: 'primaria' | 'tinte'
  tintBg?: string
  tintText?: string
}

export function AccionIcono({
  icon: Icon,
  label,
  sublabel,
  onClick,
  disabled,
  variant = 'tinte',
  tintBg = 'bg-s2',
  tintText = 'text-text-2',
}: AccionIconoProps) {
  if (variant === 'primaria') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex h-full w-full flex-col items-start justify-between gap-3 rounded-2xl bg-[#173F2E] px-3.5 py-3.5 text-left text-white shadow-card active:scale-[.98] active:bg-[#0F2E21] disabled:opacity-60"
      >
        <Icon size={20} strokeWidth={2.2} />
        <span className="text-[13px] font-bold leading-tight">{label}</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-full w-full flex-col items-start gap-2 rounded-2xl bg-white px-3.5 py-3.5 text-left shadow-card active:scale-[.98] disabled:opacity-60"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tintBg} ${tintText}`}>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <span className="block">
        <span className="block text-[13px] font-bold leading-tight text-text">{label}</span>
        {sublabel && (
          <span className="mt-0.5 block text-[11px] leading-tight text-text-3">{sublabel}</span>
        )}
      </span>
    </button>
  )
}
