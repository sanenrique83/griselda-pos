// Helpers de fecha en America/Mexico_City, compartidos por reportes con
// filtro de rango de fechas (cancelaciones, mermas). México fijó su huso a
// UTC-6 sin horario de verano desde 2022 (salvo la franja fronteriza norte,
// que no aplica aquí), así que es seguro hardcodear el offset sin depender
// de una librería de zonas horarias.

/** Fecha calendario 'YYYY-MM-DD' de hoy en America/Mexico_City */
export function fechaHoyMX(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

export function sumarDiasFecha(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

/** Inicio de un día calendario 'YYYY-MM-DD' en America/Mexico_City, como ISO UTC. */
export function inicioDiaMxUtc(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 6, 0, 0)).toISOString()
}
