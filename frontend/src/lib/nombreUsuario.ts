// Nombre de usuario/mesero a mostrar, con un único fallback en toda la app
// (F5-00) — a diferencia de `??`, `.trim() || fallback` también captura
// string vacío, no solo null/undefined. perfiles.nombre es NOT NULL a nivel
// de BD pero SÍ puede llegar como '' (el trigger handle_new_user() solo
// protege contra NULL vía COALESCE, no contra un string vacío explícito).
export const SIN_NOMBRE = 'Sin registrar'

/** Primer candidato no vacío (tras trim), o SIN_NOMBRE si ninguno califica. */
export function primerNombreValido(...candidatos: (string | null | undefined)[]): string {
  for (const c of candidatos) {
    const t = c?.trim()
    if (t) return t
  }
  return SIN_NOMBRE
}
