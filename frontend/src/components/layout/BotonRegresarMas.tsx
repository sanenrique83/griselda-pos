import Link from 'next/link'

// Botón "regresar a /mas" — mismo texto/estilo que ya usaba solo la pantalla
// de Impresoras (ImpresionShell). Es un <Link>, no un router.push en un
// onClick, para que también funcione en pantallas que son Server Component
// (ej. Recetario) sin necesitar 'use client' ni useRouter.
export function BotonRegresarMas() {
  return (
    <Link
      href="/mas"
      className="-ml-1 inline-block px-1 py-1 text-[15px] font-medium text-blue-600 active:opacity-60"
    >
      ‹ Más
    </Link>
  )
}
