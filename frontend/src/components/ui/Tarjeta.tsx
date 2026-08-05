import type { ReactNode } from 'react'

// Contenedor base de tarjeta — fundación nueva, no reemplaza las tarjetas
// existentes (que hoy usan rounded-2xl en su mayoría).
interface TarjetaProps {
  children: ReactNode
  className?: string
}

export function Tarjeta({ children, className = '' }: TarjetaProps) {
  return (
    <div className={`rounded-xl bg-white px-4 py-4 shadow-card ${className}`}>{children}</div>
  )
}
