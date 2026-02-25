import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { TurnoShell } from '@/components/turno/TurnoShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type TurnoResumen = {
  id: number
  fondoInicial: number
  abierto_en: string
  totalCobrado: number
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
  const { data: turno } = await supabase
    .from('turnos')
    .select('id, fondo_inicial, abierto_en')
    .eq('estado', 'abierto')
    .order('abierto_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Sin turno activo → mostrar form de apertura
  if (!turno) {
    return <TurnoShell turnoActivo={null} />
  }

  // ── Métricas del turno activo ──────────────────────────────────────────────
  const [movimientosRes, pedidosCerradosRes, pedidosAbiertosRes] =
    await Promise.all([
      supabase
        .from('movimientos_caja')
        .select('id, tipo, monto')
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

  const fondosExtra = movimientos
    .filter((m) => m.tipo === 'fondo')
    .reduce((s, m) => s + m.monto, 0)
  const retirosTotal = movimientos
    .filter((m) => m.tipo === 'retiro')
    .reduce((s, m) => s + m.monto, 0)

  const efectivoTeorico =
    turno.fondo_inicial + porMetodo.efectivo + fondosExtra - retirosTotal

  const turnoResumen: TurnoResumen = {
    id: turno.id,
    fondoInicial: turno.fondo_inicial,
    abierto_en: turno.abierto_en,
    totalCobrado,
    porMetodo,
    cobrosEfectivo: porMetodo.efectivo,
    fondosExtra,
    retirosTotal,
    efectivoTeorico,
    pedidosCerrados: pedidosCerradosRes.count ?? 0,
    pedidosAbiertos: pedidosAbiertosRes.count ?? 0,
  }

  return <TurnoShell turnoActivo={turnoResumen} />
}
