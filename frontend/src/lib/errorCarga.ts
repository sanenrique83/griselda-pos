// Detecta si un error es una falla de carga de un chunk de JS durante la
// navegación (típico cuando Vercel ya desplegó código nuevo mientras el
// usuario seguía con la app abierta, o una red inestable) — el
// ChunkLoadError clásico de Next.js App Router, o su equivalente en
// navegadores que reportan la falla de import() con otro mensaje. Se usa
// en error.tsx / global-error.tsx para recargar automáticamente en vez de
// dejar la pantalla en blanco.
export function esErrorDeCarga(error: Error): boolean {
  const nombre = error.name ?? ''
  const mensaje = error.message ?? ''
  return (
    nombre === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(mensaje) ||
    /Failed to fetch dynamically imported module/i.test(mensaje) ||
    /Importing a module script failed/i.test(mensaje)
  )
}
