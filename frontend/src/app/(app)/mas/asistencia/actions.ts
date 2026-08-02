'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { inicioDiaMxUtc, sumarDiasFecha } from '@/lib/fechaMx'
import type { AsistenciaFiltros, AsistenciaRow } from './page'

type Err = { error: string }

// ─── Marcar entrada / salida (propia) ──────────────────────────────────────
// Escritura directa, sin RPC: RLS ya restringe INSERT/UPDATE a la propia fila
// (usuario_id = auth.uid()), no hace falta SECURITY DEFINER aquí. El índice
// único parcial idx_asistencia_entrada_abierta es el resguardo real contra
// doble clic / dos pestañas; el SELECT previo solo da un mensaje amable en
// el caso común.

export async function marcarEntrada(): Promise<Err | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { data: abierta } = await supabase
    .from('asistencia')
    .select('id')
    .eq('usuario_id', user.id)
    .is('salida', null)
    .maybeSingle()
  if (abierta) return { error: 'Ya tienes una entrada sin marcar salida.' }

  const { error } = await supabase.from('asistencia').insert({ usuario_id: user.id })
  if (error) {
    if (error.code === '23505') return { error: 'Ya tienes una entrada sin marcar salida.' }
    return { error: 'Error al marcar tu entrada.' }
  }
  revalidatePath('/mas/asistencia')
}

export async function marcarSalida(): Promise<Err | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { data: abierta } = await supabase
    .from('asistencia')
    .select('id')
    .eq('usuario_id', user.id)
    .is('salida', null)
    .order('entrada', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!abierta) return { error: 'No tienes una entrada activa.' }

  const { error } = await supabase
    .from('asistencia')
    .update({ salida: new Date().toISOString() })
    .eq('id', abierta.id)
  if (error) return { error: 'Error al marcar tu salida.' }
  revalidatePath('/mas/asistencia')
}

// ─── Historial (admin) ──────────────────────────────────────────────────────

export async function obtenerHistorialAsistencia(
  filtros: AsistenciaFiltros,
): Promise<AsistenciaRow[] | Err> {
  const supabase = await createClient()

  let query = supabase
    .from('asistencia')
    .select('id, usuario_id, entrada, salida')
    .gte('entrada', inicioDiaMxUtc(filtros.desde))
    .lt('entrada', inicioDiaMxUtc(sumarDiasFecha(filtros.hasta, 1)))
    .order('entrada', { ascending: false })

  if (filtros.usuarioId) query = query.eq('usuario_id', filtros.usuarioId)

  const { data, error } = await query
  if (error) return { error: 'Error al cargar el historial de asistencia.' }

  const usuarioIds = Array.from(new Set((data ?? []).map((a) => a.usuario_id)))
  const { data: perfilesData } =
    usuarioIds.length > 0
      ? await supabase.from('perfiles').select('id, nombre').in('id', usuarioIds)
      : { data: [] as { id: string; nombre: string }[] }
  const nombrePorUsuario = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre]))

  return (data ?? []).map((a) => ({
    id: a.id,
    usuarioId: a.usuario_id,
    usuarioNombre: nombrePorUsuario.get(a.usuario_id) ?? 'Desconocido',
    entrada: a.entrada,
    salida: a.salida,
  }))
}

// ─── Exportar CSV (admin) ───────────────────────────────────────────────────
// No existía un reporte de "ventas por mesero" que reutilizar — se
// construyó la atribución con las mismas fuentes que ya usa el Dashboard
// para total cobrado/propina (movimientos_caja.monto/propina vía
// cobro_subpedidos → subpedidos → pedidos), agregando la dimensión que
// faltaba: mesero (pedidos.mesero_id) + ventana de asistencia (en vez de
// turno completo). "Ventas"/"propina" de un período = cobros cuyo
// created_at cae dentro de [entrada, salida ?? ahora] de esa fila.

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export async function exportarAsistenciaCSV(filtros: AsistenciaFiltros): Promise<{ csv: string } | Err> {
  const supabase = await createClient()

  let query = supabase
    .from('asistencia')
    .select('id, usuario_id, entrada, salida')
    .gte('entrada', inicioDiaMxUtc(filtros.desde))
    .lt('entrada', inicioDiaMxUtc(sumarDiasFecha(filtros.hasta, 1)))
    .order('entrada', { ascending: false })

  if (filtros.usuarioId) query = query.eq('usuario_id', filtros.usuarioId)

  const { data: asistenciaData, error } = await query
  if (error) return { error: 'Error al cargar la asistencia.' }

  const encabezado = 'usuario,entrada,salida,horas_trabajadas,ventas,propina'
  const filas = asistenciaData ?? []
  if (filas.length === 0) return { csv: `${encabezado}\n` }

  const usuarioIds = Array.from(new Set(filas.map((f) => f.usuario_id)))
  const { data: perfilesData } = await supabase.from('perfiles').select('id, nombre').in('id', usuarioIds)
  const nombrePorUsuario = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre]))

  // Ventana global (todas las filas) para acotar las queries de cobros a lo
  // necesario, en vez de traer todo el histórico de esos meseros.
  const ahoraIso = new Date().toISOString()
  let entradaMin = filas[0].entrada
  let salidaMax = filas[0].salida ?? ahoraIso
  for (const f of filas) {
    if (f.entrada < entradaMin) entradaMin = f.entrada
    const s = f.salida ?? ahoraIso
    if (s > salidaMax) salidaMax = s
  }

  const { data: pedidosData } = await supabase
    .from('pedidos')
    .select('id, mesero_id')
    .in('mesero_id', usuarioIds)
    .gte('created_at', entradaMin)
    .lte('created_at', salidaMax)
  const pedidoIds = (pedidosData ?? []).map((p) => p.id)
  const meseroPorPedido = new Map((pedidosData ?? []).map((p) => [p.id, p.mesero_id]))

  const meseroPorMovimiento = new Map<number, string>()
  let movimientos: { id: number; monto: number; propina: number; created_at: string }[] = []

  if (pedidoIds.length > 0) {
    const { data: subpedidosData } = await supabase
      .from('subpedidos')
      .select('id, pedido_id')
      .in('pedido_id', pedidoIds)
    const pedidoPorSubpedido = new Map((subpedidosData ?? []).map((s) => [s.id, s.pedido_id]))
    const subpedidoIds = (subpedidosData ?? []).map((s) => s.id)

    if (subpedidoIds.length > 0) {
      const { data: csData } = await supabase
        .from('cobro_subpedidos')
        .select('movimiento_id, subpedido_id')
        .in('subpedido_id', subpedidoIds)

      for (const cs of csData ?? []) {
        const pedidoId = pedidoPorSubpedido.get(cs.subpedido_id)
        const meseroId = pedidoId !== undefined ? meseroPorPedido.get(pedidoId) : undefined
        if (meseroId) meseroPorMovimiento.set(cs.movimiento_id, meseroId)
      }

      const movimientoIds = Array.from(meseroPorMovimiento.keys())
      if (movimientoIds.length > 0) {
        const { data: movData } = await supabase
          .from('movimientos_caja')
          .select('id, monto, propina, created_at')
          .in('id', movimientoIds)
          .eq('tipo', 'cobro')
        movimientos = movData ?? []
      }
    }
  }

  const lineas: string[] = [encabezado]
  for (const f of filas) {
    const finVentana = f.salida ?? ahoraIso
    let ventas = 0
    let propina = 0
    for (const m of movimientos) {
      if (meseroPorMovimiento.get(m.id) !== f.usuario_id) continue
      if (m.created_at < f.entrada || m.created_at > finVentana) continue
      ventas += m.monto
      propina += m.propina ?? 0
    }
    const horas = f.salida
      ? ((new Date(f.salida).getTime() - new Date(f.entrada).getTime()) / 3_600_000).toFixed(2)
      : ''
    const nombre = nombrePorUsuario.get(f.usuario_id) ?? 'Desconocido'
    lineas.push(
      [csvEscape(nombre), f.entrada, f.salida ?? '', horas, ventas.toFixed(2), propina.toFixed(2)].join(','),
    )
  }

  return { csv: lineas.join('\n') }
}
