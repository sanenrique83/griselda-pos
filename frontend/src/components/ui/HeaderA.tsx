import { Bell } from 'lucide-react'

// Header tipo A (regla de diseño transversal #4, CLAUDE.md) — pantallas raíz
// del bottom nav: logo circular + nombre/marca + píldora de turno + campana
// de notificaciones. Reusable: cualquier pantalla raíz futura (Pedidos,
// Historial, Dashboard, Más) debería montar este mismo componente en vez de
// armar su propio header a mano.
interface HeaderAProps {
  titulo: string
  subtitulo: string
  turnoId: number | null
  campanaCount?: number
  onCampanaClick?: () => void
}

export function HeaderA({ titulo, subtitulo, turnoId, campanaCount = 0, onCampanaClick }: HeaderAProps) {
  return (
    <div className="flex h-[64px] flex-shrink-0 items-center gap-3 border-b border-[#E5E5EA] bg-white px-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#173F2E] text-[15px] font-bold text-white">
        G
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-bold leading-tight text-text">{titulo}</p>
        <p className="truncate text-[11px] leading-tight text-text-3">{subtitulo}</p>
      </div>

      {turnoId ? (
        <span className="flex-shrink-0 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
          ● Turno #{turnoId}
        </span>
      ) : (
        <span className="flex-shrink-0 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
          Sin turno
        </span>
      )}

      <button
        onClick={onCampanaClick}
        aria-label="Notificaciones"
        className="relative flex-shrink-0 text-text-2 active:opacity-60"
      >
        <Bell size={22} strokeWidth={1.8} />
        {campanaCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
            {campanaCount > 9 ? '9+' : campanaCount}
          </span>
        )}
      </button>
    </div>
  )
}
