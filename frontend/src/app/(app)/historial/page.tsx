import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistorialShell } from '@/components/historial/HistorialShell'
import { primerNombreValido } from '@/lib/nombreUsuario'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type PagoResumen = {
  metodo: 'efectivo' | 'tarjeta' | 'transferencia'
  monto: number
}

export type ReciboData = {
  id: number           // movimiento_id
  createdAt: string
  mesaLabel: string
  meseroNombre: string
  clienteNombre: string | null
  total: number
  efectivoRecibido: number | null
  cambio: number | null
  pagos: PagoResumen[]
  pedidoId: number | null
  // Comensales cobrados en este recibo específico (cuántos subpedidos trae
  // este movimiento — un cobro individual solo trae 1, uno general trae
  // todos) y productos (suma de cantidad, sin cancelados) de esos mismos
  // subpedidos. Antes no se cargaba ninguno de los dos.
  numComensales: number
  numProductos: number
  // % de propina reconstruido desde movimientos_caja.propina/monto (el
  // monto SÍ se guarda ahí; el % no, así que se recalcula) — null si no
  // hubo propina en este cobro.
  propinaPct: number | null
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
      `id, monto, propina, efectivo_recibido, cambio, created_at,
       pagos(metodo_pago, monto),
       cobro_subpedidos(
         subpedidos(
           pedido_id,
           pedidos(
             tipo, mesa_id, mesero_id, cliente_nombre,
             mesas(numero, nombre)
           ),
           pedido_productos(cantidad, estado)
         )
       )`,
    )
    .eq('turno_id', turnoId)
    .eq('tipo', 'cobro')
    .order('created_at', { ascending: false })

  const rows = movimientos ?? []

  // Nombre del mesero dueño del pedido de cada recibo (F5-00: antes esta
  // pantalla no mostraba ningún nombre de usuario).
  const meseroIds = Array.from(
    new Set(
      rows
        .map((m: any) => m.cobro_subpedidos?.[0]?.subpedidos?.pedidos?.mesero_id as string | undefined)
        .filter((id: string | undefined): id is string => !!id),
    ),
  )
  const { data: perfilesData } =
    meseroIds.length > 0
      ? await supabase.from('perfiles').select('id, nombre').in('id', meseroIds)
      : { data: [] as { id: string; nombre: string }[] }
  const nombrePorUsuario = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre]))

  return rows.map((m: any) => {
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

    const cobroSubs: any[] = m.cobro_subpedidos ?? []
    const numComensales = cobroSubs.length
    const numProductos = cobroSubs.reduce((s: number, cs: any) => {
      const prods = (cs.subpedidos?.pedido_productos ?? []) as { cantidad: number; estado: string }[]
      return s + prods.filter((pp) => pp.estado !== 'cancelado').reduce((s2, pp) => s2 + pp.cantidad, 0)
    }, 0)
    const propinaPct = m.propina > 0 && m.monto > 0 ? Math.round((m.propina / m.monto) * 100) : null

    return {
      id: m.id,
      createdAt: m.created_at,
      mesaLabel,
      meseroNombre: primerNombreValido(pedido?.mesero_id ? nombrePorUsuario.get(pedido.mesero_id) : undefined),
      clienteNombre: pedido?.cliente_nombre ?? null,
      total: m.monto,
      numComensales,
      numProductos,
      propinaPct,
      efectivoRecibido: m.efectivo_recibido,
      cambio: m.cambio,
      pagos,
      pedidoId: primerSubpedido?.subpedidos?.pedido_id ?? null,
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
        turnoActivoId={turnoActivo?.id ?? null}
        isAdmin={isAdmin}
        esTurnoActivo={false}
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
      turnoActivoId={turnoActivo?.id ?? null}
      isAdmin={isAdmin}
      esTurnoActivo={turnoIdFinal === (turnoActivo?.id ?? null)}
    />
  )
}
