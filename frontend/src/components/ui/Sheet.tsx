import type { ReactNode } from 'react'

// Contenedor base de sheets — extraído del patrón repetido en ~10 sheets ya
// existentes (backdrop + panel deslizable + handle + header/body/footer).
// Fundación nueva: los sheets existentes NO se migran en este cambio; se
// migran pantalla por pantalla cuando se rediseña cada una (CLAUDE.md).
interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  // Reemplaza la barra de título por defecto cuando el encabezado necesita
  // más que texto (imagen, precio, botón cerrar propio) — ej. el sheet de
  // personalización de producto. Con `header`, `title` se ignora.
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
  // La mayoría de sheets caben en 85vh; algunos con mucho contenido (ej.
  // varios grupos de modificadores) necesitan más margen.
  maxHeightClass?: string
}

export function Sheet({ open, onClose, title, header, children, footer, maxHeightClass = 'max-h-[85vh]' }: SheetProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex ${maxHeightClass} flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />

        {header ?? (
          <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
            <h2 className="text-[17px] font-bold">{title}</h2>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">{children}</div>

        {footer && (
          <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
