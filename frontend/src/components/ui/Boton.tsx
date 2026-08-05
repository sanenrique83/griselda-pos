import type { ButtonHTMLAttributes } from 'react'

// Fundación de consistencia visual — verde bosque como color primario en vez
// de bg-blue-600 suelto. Esta es la base nueva; los ~40 archivos que hoy
// usan bg-blue-600 en botones NO se migran en este cambio (a propósito).
export type BotonVariante = 'primario' | 'secundario' | 'peligro' | 'texto'

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BotonVariante
  fullWidth?: boolean
}

const BASE = 'rounded-xl text-sm font-bold transition-transform disabled:opacity-40'

const VARIANTE_CLASES: Record<BotonVariante, string> = {
  primario:
    'bg-[#173F2E] py-[14px] text-white shadow-[0_4px_14px_rgba(23,63,46,.32)] active:scale-[.98] active:bg-[#0F2E21]',
  secundario: 'bg-s2 py-[14px] text-text-2 active:scale-[.98] active:bg-s3',
  peligro:
    'bg-red-600 py-[14px] text-white shadow-[0_4px_14px_rgba(220,38,38,.3)] active:scale-[.98]',
  texto: 'bg-transparent py-2 text-[#173F2E] font-semibold active:opacity-60',
}

export function Boton({
  variant = 'primario',
  fullWidth = true,
  className = '',
  ...props
}: BotonProps) {
  return (
    <button
      className={`${BASE} ${VARIANTE_CLASES[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}
