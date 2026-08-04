import { minutosDesdePrecuenta } from '@/lib/precuenta'
import { formatearTiempoMesa } from '@/lib/tiempoMesa'

// Chip pequeño y aparte del semáforo de color (ver lib/colorMesa.ts) — se
// usa igual en TarjetaMesa (lista), PlanoMesas (/mesas) y LienzoMesasEditor
// (/mas/mapa-mesas) para que los tres coincidan en formato.
export function AvisoPrecuenta({
  precuentaImpresaEn,
  ahora,
  className = '',
}: {
  precuentaImpresaEn: string
  ahora?: number
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ${className}`}
    >
      🧾 hace {formatearTiempoMesa(minutosDesdePrecuenta(precuentaImpresaEn, ahora))}
    </span>
  )
}
