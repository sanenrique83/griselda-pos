// Disponibilidad automática por horario (F9-04) — productos y opciones de
// modificador pueden tener su propia ventana horaria, independiente entre sí
// y del toggle manual "disponible". Solo la hora de reloj importa, sin
// relación con turnos.

/** Hora actual en America/Mexico_City, formato "HH:MM:SS" (comparable con TIME de Postgres) */
export function horaActualMX(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'America/Mexico_City',
    hour12: false,
  })
}

/**
 * true si `horaActual` cae dentro de [desde, hasta]. NULL en ambos = sin
 * restricción. Si solo uno está definido, el otro se trata como el extremo
 * abierto del día (00:00:00 / 23:59:59). Soporta rangos que cruzan
 * medianoche (ej. 22:00–02:00).
 */
export function dentroDeHorario(
  desde: string | null,
  hasta: string | null,
  horaActual: string,
): boolean {
  if (desde === null && hasta === null) return true
  const d = desde ?? '00:00:00'
  const h = hasta ?? '23:59:59'
  return d <= h ? horaActual >= d && horaActual <= h : horaActual >= d || horaActual <= h
}
