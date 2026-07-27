import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistorialShell } from '@/components/historial/HistorialShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type PagoResumen = {
  metodo: 'efectivo' | 'tarjeta' | 'transferencia'
  monto: number
}

export type ReciboData = {
  id: number           // movimiento_id
  createdAt: string
  mesaLabel: string
  total: number
  efectivoRecibido: number | null
  cambio: number | null
  pagos: PagoResumen[]
}

export type TurnoItem = {
  id: number
  abierto_en: string
  cerrado_en: string | null
  estado: 'abierto' | 'cerrado'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cargarRecibos(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, turnoId: number): Promise<ReciboData[]> {
  const { data: movimientos } = await supabase
    .from('movimientos_caja')
    .select(
      `id, monto, efectivo_recibido, cambio, created_at,
       pagos(metodo_pago, monto),
       cobro_subpedidos(
         subpedidos(
           pedidos(
             tipo, mesa_id,
             mesas(numero, nombre)
           )
         )
       )`,
    )
    .eq('turno_id', turnoId)
    .eq('tipo', 'cobro')
    .order('created_at', { ascending: false })

  return (movimientos ?? []).map((m: any) => {
    const primerSubpedido = (m.cobro_subpedidos ?? [])[0]
    const pedido = primerSubpedido?.subpedidos?.pedidos

    let mesaLabel = 'Para llevar'
    if (pedido) {
      if (pedido.tipo === 'mesa' && pedido.mesas) {
        const mesa = pedido.mesas as { numero: number; nombre: string | null }
        mesaLabel = `Mesa ${mesa.nombre ?? mesa.numero}`
      } else if (pedido.tipo === 'mostrador') {
        mesaLabel = 'Mostrador'
      }
    }

    const pagos: PagoResumen[] = (m.pagos ?? []).map((p: any) => ({
      metodo: p.metodo_pago as PagoResumen['metodo'],
      monto: p.monto,
    }))

    return {
      id: m.id,
      createdAt: m.created_at,
      mesaLabel,
      total: m.monto,
      efectivoRecibido: m.efectivo_recibido,
      cambio: m.cambio,
      pagos,
    }
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ turno?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  const isAdmin = (perfil as any)?.rol === 'admin'

  // Turno activo
  const { data: turnoActivo } = await supabase
    .from('turnos')
    .select('id, abierto_en, cerrado_en, estado')
    .eq('estado', 'abierto')
    .order('abierto_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Lista de turnos (solo para admin)
  let turnos: TurnoItem[] = []
  if (isAdmin) {
    const { data: allTurnos } = await supabase
      .from('turnos')
      .select('id, abierto_en, cerrado_en, estado')
      .order('abierto_en', { ascending: false })
      .limit(30)
    turnos = (allTurnos ?? []) as TurnoItem[]
  }

  // Determinar qué turno cargar
  const params = await searchParams
  const turnoIdParam = params.turno ? parseInt(params.turno) : null
  const turnoIdFinal = isAdmin && turnoIdParam && !isNaN(turnoIdParam)
    ? turnoIdParam
    : turnoActivo?.id ?? null

  if (!turnoIdFinal) {
    return (
      <HistorialShell
        recibos={[]}
        sinTurno
        turnos={turnos}
        turnoSeleccionadoId={null}
        isAdmin={isAdmin}
      />
    )
  }

  const recibos = await cargarRecibos(supabase, turnoIdFinal)

  return (
    <HistorialShell
      recibos={recibos}
      sinTurno={false}
      turnos={turnos}
      turnoSeleccionadoId={turnoIdFinal}
      isAdmin={isAdmin}
    />
  )
}
