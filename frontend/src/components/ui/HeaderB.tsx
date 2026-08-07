import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

// Header tipo B (regla de diseño transversal #4, CLAUDE.md) — pantallas de
// detalle: flecha atrás + título + acciones contextuales a la derecha.
// Reusable: cualquier pantalla de detalle futura (Cobro, etc.) debería
// montar este mismo componente en vez de armar su propio header a mano,
// igual que HeaderA.tsx para las pantallas raíz.
interface HeaderBProps {
  backLabel: string
  onBack: () => void
  titulo: string
  subtitulo?: ReactNode
  children?: ReactNode // acción principal a la derecha del título (ej. "Cobrar")
}

export function HeaderB({ backLabel, onBack, titulo, subtitulo, children }: HeaderBProps) {
  return (
    <div className="flex-shrink-0 border-b border-[#E5E5EA] bg-white px-4 pt-2.5 pb-3">
      <button
        onClick={onBack}
        className="-ml-1 flex items-center gap-0.5 px-1 py-1 text-[13px] font-medium text-text-3 active:opacity-60"
      >
        <ArrowLeft size={16} strokeWidth={2.4} />
        {backLabel}
      </button>

      <div className="mt-0.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[20px] font-bold leading-tight text-text">{titulo}</p>
          {subtitulo && <div className="mt-1">{subtitulo}</div>}
        </div>
        {children && <div className="flex-shrink-0 pt-0.5">{children}</div>}
      </div>
    </div>
  )
}
