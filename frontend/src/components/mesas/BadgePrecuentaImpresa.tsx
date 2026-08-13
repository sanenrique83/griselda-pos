import { Printer } from 'lucide-react'

// Indicador SIEMPRE visible en cuanto hay precuenta impresa sin cobrar —
// distinto de AvisoPrecuenta.tsx (que solo aparece pasado el umbral de
// alerta configurado en /mas/permisos). Este es un hecho ("ya se imprimió,
// probablemente están listos para pagar"), no una alerta de demora; por eso
// no depende de alertaPrecuentaActiva/alertaPrecuentaMinutos. Se usa igual
// en TarjetaMesa (lista) y PlanoMesas (mapa) de /mesas.
export function BadgePrecuentaImpresa({ className = '' }: { className?: string }) {
  return (
    <span
      title="Precuenta impresa, sin cobrar"
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ${className}`}
    >
      <Printer size={11} strokeWidth={2.4} />
    </span>
  )
}
