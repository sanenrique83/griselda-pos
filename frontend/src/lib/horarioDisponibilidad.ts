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

/**
 * Minutos desde `horaActual` hasta la próxima vez que el reloj marque
 * `horaObjetivo` — si ya pasó hoy, asume que es mañana (cruza medianoche).
 * Usado por el recordatorio de fin de turno programado (turnos_horario):
 * "faltan X min para la hora_fin de mi turno".
 */
export function minutosHastaHora(horaObjetivo: string, horaActual: string): number {
  const [hO, mO] = horaObjetivo.split(':').map(Number)
  const [hA, mA] = horaActual.split(':').map(Number)
  const minObjetivo = hO * 60 + mO
  const minActual = hA * 60 + mA
  const diff = minObjetivo - minActual
  return diff >= 0 ? diff : diff + 24 * 60
}
