'use client'

import { useRouter } from 'next/navigation'
import { History } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import type { TurnoCerradoResumen } from '@/app/(app)/mesas/page'

interface SheetTurnosProps {
  open: boolean
  onClose: () => void
  turnosCerrados: TurnoCerradoResumen[]
  turnoActivoId: number | null
}

// Turno desplegable (punto 3 del rediseño de Mesas, solo Admin) — lista de
// los últimos turnos cerrados para ver su Panel del turno en modo de solo
// lectura. Nunca calcula nada aquí: solo navega a /mesas?turno=<id>, el
// cálculo histórico vive en mesas/page.tsx (cargarPanelTurnoHistorico).
export function SheetTurnos({ open, onClose, turnosCerrados, turnoActivoId }: SheetTurnosProps) {
  const router = useRouter()

  function verTurnoActivo() {
    onClose()
    router.push('/mesas')
  }

  function verTurnoCerrado(id: number) {
    onClose()
    router.push(`/mesas?turno=${id}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Turnos">
      <button
        onClick={verTurnoActivo}
        className="flex w-full items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3.5 py-3 text-left active:opacity-70"
      >
        <span className="text-[13px] font-semibold text-green-700">● Turno #{turnoActivoId} (activo)</span>
      </button>

      {turnosCerrados.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-text-3">Sin turnos cerrados todavía.</p>
      ) : (
        <div className="space-y-1.5">
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">Turnos cerrados</p>
          {turnosCerrados.map((t) => (
            <button
              key={t.id}
              onClick={() => verTurnoCerrado(t.id)}
              className="flex w-full items-center gap-2.5 rounded-xl bg-s2 px-3.5 py-3 text-left active:opacity-70"
            >
              <History size={16} strokeWidth={2} className="flex-shrink-0 text-text-3" />
              <div>
                <p className="text-[13px] font-semibold text-text">Turno #{t.id}</p>
                <p className="text-[11px] text-text-3">Cerrado {t.fechaCierre}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
