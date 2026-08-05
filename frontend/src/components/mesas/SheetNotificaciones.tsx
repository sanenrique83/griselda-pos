'use client'

import { useRouter } from 'next/navigation'
import { TrendingDown, Receipt } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { formatCurrency } from '@/components/ui/tokens'
import type { AlertaVentasBajas } from '@/lib/alertaVentasBajas'
import type { AlertaPrecuentaMesa } from '@/app/(app)/mesas/page'
import { formatearTiempoMesa } from '@/lib/tiempoMesa'

interface SheetNotificacionesProps {
  open: boolean
  onClose: () => void
  alertaVentasBajas: AlertaVentasBajas | null
  alertasPrecuenta: AlertaPrecuentaMesa[]
}

// Campana centralizada (punto 1 del rediseño de Mesas): agrupa alertas del
// SISTEMA — ventas bajas, precuenta impresa sin cobrar, y cualquier alerta
// similar futura. El semáforo de mesa (lib/colorMesa.ts) NUNCA se duplica
// aquí — sigue siendo su propio sistema visual, solo en el mapa/lista.
export function SheetNotificaciones({ open, onClose, alertaVentasBajas, alertasPrecuenta }: SheetNotificacionesProps) {
  const router = useRouter()
  const sinNotificaciones = !alertaVentasBajas && alertasPrecuenta.length === 0

  return (
    <Sheet open={open} onClose={onClose} title="Notificaciones">
      {sinNotificaciones ? (
        <p className="py-6 text-center text-[13px] text-text-3">Sin notificaciones por ahora.</p>
      ) : (
        <>
          {alertaVentasBajas && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
              <TrendingDown size={18} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-xs font-semibold text-red-700">
                  Ventas {Math.abs(alertaVentasBajas.desviacionPct).toFixed(0)}% por debajo de lo normal para esta
                  hora
                </p>
                <p className="mt-0.5 text-[11px] text-red-600">
                  {formatCurrency(alertaVentasBajas.totalActual)} cobrado vs.{' '}
                  {formatCurrency(alertaVentasBajas.promedioHistorico)} en promedio a esta hora, mismo día de la
                  semana.
                </p>
              </div>
            </div>
          )}

          {alertasPrecuenta.map((a) => (
            <button
              key={a.pedidoId}
              onClick={() => {
                onClose()
                router.push(`/pos/${a.pedidoId}`)
              }}
              className="flex w-full items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3 text-left active:opacity-70"
            >
              <Receipt size={18} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-700">{a.mesaLabel} — precuenta sin cobrar</p>
                <p className="mt-0.5 text-[11px] text-amber-600">
                  Impresa hace {formatearTiempoMesa(a.minutos)} sin registrar el cobro.
                </p>
              </div>
            </button>
          ))}
        </>
      )}
    </Sheet>
  )
}
