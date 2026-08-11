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
  id: number           // movimiento_id (cobro) o pedido_id (cancelada — no hay movimiento)
  // 'cobro' = tiene movimientos_caja tipo='cobro' real (badge "Cerrada").
  // 'cancelada' = pedido cerrado sin ningún cobro asociado (badge "Cancelada").
  estado: 'cobro' | 'cancelada'
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

type SupabaseClientType = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

function resolverMesaLabel(pedido: any): string {
  if (!pedido) return 'Para llevar'
  if (pedido.tipo === 'mesa' && pedido.mesas) {
    const mesa = pedido.mesas as { numero: number; nombre: string | null }
    return `Mesa ${mesa.nombre ?? mesa.numero}`
  }
  if (pedido.tipo === 'mostrador') return 'Mostrador'
  return 'Para llevar'
}

async function cargarRecibosCobrados(
  supabase: SupabaseClientType,
  turnoId: number,
): Promise<{ recibos: ReciboData[]; pedidoIdsConCobro: Set<number>; meseroIds: Set<string> }> {
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
  const pedidoIdsConCobro = new Set<number>()
  const meseroIds = new Set<string>()

  const recibos: ReciboData[] = rows.map((m: any) => {
    const primerSubpedido = (m.cobro_subpedidos ?? [])[0]
    const pedido = primerSubpedido?.subpedidos?.pedidos
    const pedidoId = primerSubpedido?.subpedidos?.pedido_id ?? null
    if (pedidoId) pedidoIdsConCobro.add(pedidoId)
    if (pedido?.mesero_id) meseroIds.add(pedido.mesero_id)

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
      estado: 'cobro',
      createdAt: m.created_at,
      mesaLabel: resolverMesaLabel(pedido),
      meseroNombre: '', // se resuelve después de juntar todos los meseroIds (cobros + cancelados)
      clienteNombre: pedido?.cliente_nombre ?? null,
      total: m.monto,
      numComensales,
      numProductos,
      propinaPct,
      efectivoRecibido: m.efectivo_recibido,
      cambio: m.cambio,
      pagos,
      pedidoId,
      _meseroId: pedido?.mesero_id ?? null,
    } as any
  })

  return { recibos, pedidoIdsConCobro, meseroIds }
}

// ─── Cuentas canceladas ─────────────────────────────────────────────────────
// Un pedido "cancelado" (badge "Cancelada") no es un estado propio de
// `pedidos.estado` (solo existe 'abierto'/'cerrado') — se deriva: cerrado +
// SIN ningún cobro asociado + con al menos un subpedido/producto real.
// El filtro "con subpedidos" es necesario para no confundir esto con un
// pedido que se cerró por fusión (unirMesas() mueve sus subpedidos al
// destino y lo deja vacío, no cancelado) — verificado contra la base real:
// hay pedidos 'cerrado' con 0 subpedidos que son fusiones, no cancelaciones.
// No se agregan pedidos 'abierto' — esos ya viven en /pedidos.
async function cargarCancelados(
  supabase: SupabaseClientType,
  turnoId: number,
  pedidoIdsConCobro: Set<number>,
): Promise<{ recibos: ReciboData[]; meseroIds: Set<string> }> {
  const { data: pedidosCerrados } = await supabase
    .from('pedidos')
    .select(
      `id, tipo, mesa_id, mesero_id, cliente_nombre, cerrado_en, created_at,
       mesas(numero, nombre),
       subpedidos(id, pedido_productos(cantidad, estado))`,
    )
    .eq('turno_id', turnoId)
    .eq('estado', 'cerrado')

  const meseroIds = new Set<string>()

  const recibos: ReciboData[] = (pedidosCerrados ?? [])
    .filter((p: any) => !pedidoIdsConCobro.has(p.id) && (p.subpedidos ?? []).length > 0)
    .map((p: any) => {
      if (p.mesero_id) meseroIds.add(p.mesero_id)
      const subs: any[] = p.subpedidos ?? []
      const numProductos = subs.reduce(
        (s: number, sp: any) => s + (sp.pedido_productos ?? []).reduce((s2: number, pp: any) => s2 + pp.cantidad, 0),
        0,
      )

      return {
        id: p.id,
        estado: 'cancelada',
        createdAt: p.cerrado_en ?? p.created_at,
        mesaLabel: resolverMesaLabel(p),
        meseroNombre: '',
        clienteNombre: p.cliente_nombre ?? null,
        total: 0,
        numComensales: subs.length,
        numProductos,
        propinaPct: null,
        efectivoRecibido: null,
        cambio: null,
        pagos: [],
        pedidoId: p.id,
        _meseroId: p.mesero_id ?? null,
      } as any
    })

  return { recibos, meseroIds }
}

async function cargarRecibos(supabase: SupabaseClientType, turnoId: number): Promise<ReciboData[]> {
  const { recibos: cobrados, pedidoIdsConCobro, meseroIds: meseroIdsCobro } =
    await cargarRecibosCobrados(supabase, turnoId)
  const { recibos: cancelados, meseroIds: meseroIdsCancel } =
    await cargarCancelados(supabase, turnoId, pedidoIdsConCobro)

  const todosMeseroIds = Array.from(new Set([...meseroIdsCobro, ...meseroIdsCancel]))
  const { data: perfilesData } =
    todosMeseroIds.length > 0
      ? await supabase.from('perfiles').select('id, nombre').in('id', todosMeseroIds)
      : { data: [] as { id: string; nombre: string }[] }
  const nombrePorUsuario = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre]))

  const todos = [...cobrados, ...cancelados].map((r: any) => {
    const { _meseroId, ...rest } = r
    return {
      ...rest,
      meseroNombre: primerNombreValido(_meseroId ? nombrePorUsuario.get(_meseroId) : undefined),
    } as ReciboData
  })

  todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return todos
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
