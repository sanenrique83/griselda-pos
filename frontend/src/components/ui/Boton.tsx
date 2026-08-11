import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import Link from 'next/link'

// Fundación de consistencia visual — verde bosque como color primario en vez
// de bg-blue-600 suelto. Esta es la base nueva; los ~40 archivos que hoy
// usan bg-blue-600 en botones NO se migran en este cambio (a propósito).
export type BotonVariante = 'primario' | 'secundario' | 'peligro' | 'texto' | 'outline'

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-transform disabled:opacity-40'

const VARIANTE_CLASES: Record<BotonVariante, string> = {
  primario:
    'bg-[#173F2E] py-[14px] text-white shadow-[0_4px_14px_rgba(23,63,46,.32)] active:scale-[.98] active:bg-[#0F2E21]',
  secundario: 'bg-s2 py-[14px] text-text-2 active:scale-[.98] active:bg-s3',
  peligro:
    'bg-red-600 py-[14px] text-white shadow-[0_4px_14px_rgba(220,38,38,.3)] active:scale-[.98]',
  texto: 'bg-transparent py-2 text-[#173F2E] font-semibold active:opacity-60',
  // Verde bosque en contorno — mismo peso visual que "primario" pero de
  // menor énfasis (ej. una acción secundaria de navegación como "Abrir
  // comanda"), sin caer en "secundario" (gris, se lee como neutral/pasivo).
  outline: 'border-2 border-[#173F2E] bg-white py-3 text-[#173F2E] active:scale-[.98] active:bg-[#173F2E]/5',
}

type BotonBaseProps = {
  variant?: BotonVariante
  fullWidth?: boolean
  className?: string
}

// `href` hace que Boton se renderice como next/link (navegación) en vez de
// <button> — mismo aspecto visual, para no tener que reproducir las clases
// a mano donde la acción es "ir a" en vez de "hacer algo aquí" (ver
// PedidosShell.tsx, "Abrir comanda").
type BotonProps =
  | (BotonBaseProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>)
  | (BotonBaseProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>)

export function Boton({
  variant = 'primario',
  fullWidth = true,
  className = '',
  href,
  ...props
}: BotonProps) {
  const classes = `${BASE} ${VARIANTE_CLASES[variant]} ${fullWidth ? 'w-full' : ''} ${className}`

  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={classes}
        {...(props as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>)}
      />
    )
  }

  return (
    <button
      className={classes}
      {...(props as Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>)}
    />
  )
}
