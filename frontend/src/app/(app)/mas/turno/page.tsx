import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { TurnoShell } from '@/components/turno/TurnoShell'
import { horaActualMX, minutosHastaHora } from '@/lib/horarioDisponibilidad'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type MovimientoCajaItem = {
  id: number
  tipo: 'fondo' | 'retiro'
  monto: number
  notas: string | null
  created_at: string
}

// Recordatorio proactivo (no validación) de fin de turno programado — null
// si no aplica (sin patrón emparejado, apagado en config, o fuera de la
// ventana de minutos configurada).
export type RecordatorioFinTurno = {
  nombre: string
  minutosRestantes: number
}

export type TurnoResumen = {
  id: number
  fondoInicial: number
  abierto_en: string
  totalCobrado: number
  propinaTotal: number
  propinaEfectivo: number
  propinaTarjeta: number
  porMetodo: {
    efectivo: number
    tarjeta: number
    transferencia: number
  }
  cobrosEfectivo: number
  fondosExtra: number
  retirosTotal: number
  efectivoTeorico: number
  pedidosCerrados: number
  pedidosAbiertos: number
  movimientos: MovimientoCajaItem[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TurnoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single<Pick<Perfil, 'rol'>>()

  if (perfil?.rol !== 'admin') redirect('/mas')

  // ── Turno activo ──────────────────────────────────────────────────────────
  const [{ data: turno }, { data: config }] = await Promise.all([
    supabase
      .from('turnos')
      .select('id, fondo_inicial, abierto_en, turno_horario_id')
      .eq('estado', 'abierto')
      .order('abierto_en', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('config_sistema')
      .select('turno_diferencia_alerta_monto, recordatorio_fin_turno_activo, recordatorio_fin_turno_minutos')
      .eq('id', 1)
      .single(),
  ])

  const diferenciaAlertaMonto = (config as any)?.turno_diferencia_alerta_monto ?? 50

  // Sin turno activo → mostrar form de apertura
  if (!turno) {
    return <TurnoShell turnoActivo={null} diferenciaAlertaMonto={diferenciaAlertaMonto} />
  }

  // ── Recordatorio proactivo de fin de turno programado ──────────────────────
  let recordatorioFinTurno: RecordatorioFinTurno | null = null
  const recordatorioActivo = (config as any)?.recordatorio_fin_turno_activo ?? true
  const recordatorioMinutos = (config as any)?.recordatorio_fin_turno_minutos ?? 20
  if (recordatorioActivo && turno.turno_horario_id) {
    const { data: horario } = await supabase
      .from('turnos_horario')
      .select('nombre, hora_fin')
      .eq('id', turno.turno_horario_id)
      .single()

    if (horario) {
      const minutosRestantes = minutosHastaHora(horario.hora_fin, horaActualMX())
      if (minutosRestantes <= recordatorioMinutos) {
        recordatorioFinTurno = { nombre: horario.nombre, minutosRestantes }
      }
    }
  }

  // ── Métricas del turno activo ──────────────────────────────────────────────
  const [movimientosRes, pedidosCerradosRes, pedidosAbiertosRes, movsFondoRetiroRes] =
    await Promise.all([
      supabase
        .from('movimientos_caja')
        .select('id, tipo, monto, propina, propina_efectivo, propina_tarjeta')
        .eq('turno_id', turno.id),
      supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('turno_id', turno.id)
        .eq('estado', 'cerrado'),
      supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('turno_id', turno.id)
        .eq('estado', 'abierto'),
      supabase
        .from('movimientos_caja')
        .select('id, tipo, monto, notas, created_at')
        .eq('turno_id', turno.id)
        .in('tipo', ['fondo', 'retiro'])
        .order('created_at', { ascending: false }),
    ])

  const movimientos = movimientosRes.data ?? []

  // Pagos del turno (solo cobros)
  const cobroIds = movimientos.filter((m) => m.tipo === 'cobro').map((m) => m.id)
  const { data: pagos } =
    cobroIds.length > 0
      ? await supabase
          .from('pagos')
          .select('metodo_pago, monto')
          .in('movimiento_id', cobroIds)
      : { data: [] as { metodo_pago: string; monto: number }[] }

  // Agregar por método
  const porMetodo = (pagos ?? []).reduce(
    (acc, p) => {
      if (p.metodo_pago === 'efectivo') acc.efectivo += p.monto
      else if (p.metodo_pago === 'tarjeta') acc.tarjeta += p.monto
      else if (p.metodo_pago === 'transferencia') acc.transferencia += p.monto
      return acc
    },
    { efectivo: 0, tarjeta: 0, transferencia: 0 },
  )

  const totalCobrado = movimientos
    .filter((m) => m.tipo === 'cobro')
    .reduce((s, m) => s + m.monto, 0)

  const propinaTotal = movimientos
    .filter((m) => m.tipo === 'cobro')
    .reduce((s, m) => s + ((m as { propina?: number }).propina ?? 0), 0)

  const propinaEfectivo = movimientos
    .filter((m) => m.tipo === 'cobro')
    .reduce((s, m) => s + ((m as { propina_efectivo?: number }).propina_efectivo ?? 0), 0)

  const propinaTarjeta = movimientos
    .filter((m) => m.tipo === 'cobro')
    .reduce((s, m) => s + ((m as { propina_tarjeta?: number }).propina_tarjeta ?? 0), 0)

  const fondosExtra = movimientos
    .filter((m) => m.tipo === 'fondo')
    .reduce((s, m) => s + m.monto, 0)
  const retirosTotal = movimientos
    .filter((m) => m.tipo === 'retiro')
    .reduce((s, m) => s + m.monto, 0)

  // porMetodo.efectivo ya es el monto físico recibido en efectivo (incluye
  // la propina en efectivo, ver PagoInput en cobro/[pedidoId]/actions.ts), y
  // excluye la propina en tarjeta/transferencia al sumar solo pagos 'efectivo'.
  // No sumar propinaEfectivo aparte: ya está contada aquí.
  const efectivoTeorico =
    turno.fondo_inicial + porMetodo.efectivo + fondosExtra - retirosTotal

  const turnoResumen: TurnoResumen = {
    id: turno.id,
    fondoInicial: turno.fondo_inicial,
    abierto_en: turno.abierto_en,
    totalCobrado,
    propinaTotal,
    propinaEfectivo,
    propinaTarjeta,
    porMetodo,
    cobrosEfectivo: porMetodo.efectivo,
    fondosExtra,
    retirosTotal,
    efectivoTeorico,
    pedidosCerrados: pedidosCerradosRes.count ?? 0,
    pedidosAbiertos: pedidosAbiertosRes.count ?? 0,
    movimientos: (movsFondoRetiroRes.data ?? []) as MovimientoCajaItem[],
  }

  return (
    <TurnoShell
      turnoActivo={turnoResumen}
      diferenciaAlertaMonto={diferenciaAlertaMonto}
      recordatorioFinTurno={recordatorioFinTurno}
    />
  )
}
