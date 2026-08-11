'use server'

import { createClient } from '@/lib/supabase/server'
import type { ModoOrden, ModoOrdenModificadores } from '@/lib/ordenCatalogo'

type Err = { error: string }

export async function actualizarPermiso(
  campo: string,
  valor: boolean,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ [campo]: valor })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el permiso.' }
}

export async function actualizarBanco(patch: {
  transferencia_banco?: string | null
  transferencia_clabe?: string | null
  transferencia_titular?: string | null
}): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update(patch)
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los datos bancarios.' }
}

// Reemplaza a actualizarPropina() (un solo porcentaje) — ahora se guardan
// varios, separados por comas, para mostrarse como chips seleccionables al
// cobrar (ver CobroShell.tsx). `csv` ya viene validado/limpio del cliente.
export async function actualizarPropinasSugeridas(
  csv: string,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ propinas_sugeridas_pct: csv })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar la propina.' }
}

export async function actualizarTimeoutInactividad(
  minutos: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ timeout_inactividad_minutos: minutos })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el tiempo de inactividad.' }
}

export async function actualizarModificadoresPorLinea(
  cantidad: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ modificadores_por_linea: cantidad })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los modificadores por línea.' }
}

export async function actualizarTiempoMesaAlerta(
  minutos: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ tiempo_mesa_alerta_minutos: minutos })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el umbral del temporizador de mesa.' }
}

export async function actualizarAlertaMesaMinutos(
  minutos: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ alerta_mesa_sin_atender_minutos: minutos })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los minutos de alerta.' }
}

export async function actualizarAlertaVentasBajasUmbral(
  pct: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ alerta_ventas_bajas_umbral_pct: pct })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el umbral de alerta de ventas bajas.' }
}

export async function actualizarTurnoDiferenciaAlerta(
  monto: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ turno_diferencia_alerta_monto: monto })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el umbral de diferencia de turno.' }
}

export async function actualizarAlertaPrecuentaMinutos(
  minutos: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ alerta_precuenta_minutos: minutos })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los minutos de alerta de precuenta.' }
}

export async function actualizarOrdenProductos(
  modo: ModoOrden,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ orden_productos: modo })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el orden de productos.' }
}

export async function actualizarOrdenModificadores(
  modo: ModoOrdenModificadores,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ orden_modificadores: modo })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el orden de modificadores.' }
}

export async function actualizarOrdenPopularidadDias(
  dias: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ orden_popularidad_dias: dias })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los días de popularidad.' }
}

export async function actualizarFormatoModificadoresTicket(
  formato: 'lista' | 'agrupado' | 'texto_natural',
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ formato_modificadores_ticket: formato })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el formato de modificadores del ticket.' }
}

// ─── Recordatorio de fin de turno programado ───────────────────────────────

export async function actualizarRecordatorioFinTurnoMinutos(
  minutos: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ recordatorio_fin_turno_minutos: minutos })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los minutos del recordatorio.' }
}

// ─── Patrones de turno (turnos_horario) ────────────────────────────────────
// Catálogo simple, configurado una sola vez — abrirTurno() lo usa para
// emparejar el turno recién abierto contra un patrón fijo (ver
// lib/horarioDisponibilidad.ts). "Desactivar" (activo=false) en vez de
// borrar, para no romper turnos ya emparejados con un patrón viejo.

export async function crearTurnoHorario(data: {
  nombre: string
  horaInicio: string
  horaFin: string
}): Promise<{ id: number } | Err> {
  const supabase = await createClient()
  const { data: nuevo, error } = await supabase
    .from('turnos_horario')
    .insert({ nombre: data.nombre, hora_inicio: data.horaInicio, hora_fin: data.horaFin, activo: true })
    .select('id')
    .single()

  if (error || !nuevo) return { error: 'Error al crear el patrón de turno.' }
  return { id: nuevo.id }
}

export async function actualizarTurnoHorario(
  id: number,
  patch: { nombre?: string; horaInicio?: string; horaFin?: string; activo?: boolean },
): Promise<Err | undefined> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('turnos_horario')
    .update({
      ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
      ...(patch.horaInicio !== undefined ? { hora_inicio: patch.horaInicio } : {}),
      ...(patch.horaFin !== undefined ? { hora_fin: patch.horaFin } : {}),
      ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
    })
    .eq('id', id)

  if (error) return { error: 'Error al actualizar el patrón de turno.' }
}
