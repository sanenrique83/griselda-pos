'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { horaActualMX, dentroDeHorario } from '@/lib/horarioDisponibilidad'

// ─── Abrir turno ──────────────────────────────────────────────────────────────

export async function abrirTurno(
  fondoInicial: number,
): Promise<{ error: string } | void> {
  if (fondoInicial < 0) return { error: 'El fondo inicial no puede ser negativo.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // Verificar que no haya un turno ya abierto
  const { data: existing } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .limit(1)
    .maybeSingle()

  if (existing) return { error: 'Ya hay un turno activo.' }

  // Emparejamiento automático contra los patrones fijos (turnos_horario) —
  // reutiliza dentroDeHorario() (ya soporta cruce de medianoche), no repite
  // esa lógica aparte. Si la hora actual no cae en exactamente uno de los
  // patrones activos (ninguno, o más de uno se traslapan), queda NULL — el
  // recordatorio de fin de turno simplemente no aplica para ese turno.
  const horaActual = horaActualMX()
  const { data: horarios } = await supabase
    .from('turnos_horario')
    .select('id, hora_inicio, hora_fin')
    .eq('activo', true)

  const coincidencias = (horarios ?? []).filter((h) =>
    dentroDeHorario(h.hora_inicio, h.hora_fin, horaActual),
  )
  const turnoHorarioId = coincidencias.length === 1 ? coincidencias[0].id : null

  const { error } = await supabase.from('turnos').insert({
    usuario_id: user.id,
    fondo_inicial: fondoInicial,
    turno_horario_id: turnoHorarioId,
  })

  if (error) return { error: 'Error al abrir el turno.' }

  redirect('/mas/turno')
}

// ─── Registrar movimiento mid-turno ───────────────────────────────────────────

// Vía registrar_fondo_caja() (SECURITY DEFINER, migración 20260801000031)
// en vez de insert directo a movimientos_caja — mismas validaciones,
// re-verificadas también server-side dentro de la función.
export async function registrarMovimiento(data: {
  turnoId: number
  tipo: 'fondo' | 'retiro'
  monto: number
  notas: string | null
}): Promise<{ error: string } | void> {
  if (data.monto <= 0) return { error: 'El monto debe ser mayor a cero.' }

  const supabase = await createClient()

  const { error } = await supabase.rpc('registrar_fondo_caja', {
    p_turno_id: data.turnoId,
    p_tipo: data.tipo,
    p_monto: data.monto,
    p_notas: data.notas,
  })

  if (error) {
    console.error('[registrarMovimiento] error RPC registrar_fondo_caja:', error)
    return { error: error.message || 'Error al registrar el movimiento.' }
  }
}

// ─── Cerrar turno ─────────────────────────────────────────────────────────────

export async function cerrarTurno(data: {
  turnoId: number
  efectivoContado: number
  notas: string | null
}): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // No cerrar si hay pedidos abiertos
  const { count: pedidosAbiertos } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('turno_id', data.turnoId)
    .eq('estado', 'abierto')

  if (pedidosAbiertos && pedidosAbiertos > 0) {
    return {
      error: `Hay ${pedidosAbiertos} pedido${pedidosAbiertos !== 1 ? 's' : ''} abierto${
        pedidosAbiertos !== 1 ? 's' : ''
      }. Ciérralos antes de cerrar el turno.`,
    }
  }

  // Recalcular efectivo teórico server-side
  const { data: movimientos } = await supabase
    .from('movimientos_caja')
    .select('id, tipo, monto')
    .eq('turno_id', data.turnoId)

  const cobroIds = (movimientos ?? [])
    .filter((m) => m.tipo === 'cobro')
    .map((m) => m.id)

  let cobrosEfectivo = 0
  if (cobroIds.length > 0) {
    const { data: pagosEf } = await supabase
      .from('pagos')
      .select('monto')
      .in('movimiento_id', cobroIds)
      .eq('metodo_pago', 'efectivo')
    cobrosEfectivo = (pagosEf ?? []).reduce((s, p) => s + p.monto, 0)
  }

  const { data: turno } = await supabase
    .from('turnos')
    .select('fondo_inicial')
    .eq('id', data.turnoId)
    .single()

  const fondosExtra = (movimientos ?? [])
    .filter((m) => m.tipo === 'fondo')
    .reduce((s, m) => s + m.monto, 0)
  const retirosTotal = (movimientos ?? [])
    .filter((m) => m.tipo === 'retiro')
    .reduce((s, m) => s + m.monto, 0)

  const efectivoTeorico =
    (turno?.fondo_inicial ?? 0) + cobrosEfectivo + fondosExtra - retirosTotal
  const diferencia =
    Math.round((data.efectivoContado - efectivoTeorico) * 100) / 100

  const { error } = await supabase
    .from('turnos')
    .update({
      estado: 'cerrado',
      cerrado_en: new Date().toISOString(),
      cerrado_por: user.id,
      efectivo_contado: data.efectivoContado,
      diferencia,
      notas: data.notas,
    })
    .eq('id', data.turnoId)

  if (error) return { error: 'Error al cerrar el turno.' }

  redirect('/mas')
}
