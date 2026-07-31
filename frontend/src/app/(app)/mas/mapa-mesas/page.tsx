import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'
import { LienzoMesasEditor } from '@/components/mapa-mesas/LienzoMesasEditor'
import { calcularOcupacionPorMesa } from '@/lib/asientos'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type MesaEditable = {
  id: number
  numero: number
  nombre: string | null
  areaNombre: string
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  posX: number | null
  posY: number | null
  capacidad: number | null
  asientosHorario: boolean
  ocupadas: number
  // Pedido abierto que ocupa esta mesa (como principal o como satélite unida
  // vía pedido_mesas) — agrupa mesas unidas para el conector visual.
  pedidoActivoId: number | null
  algunoPagadoNoTodos: boolean
  tieneProductos: boolean
  pedidoCreatedAt: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MapaMesasPage() {
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

  const [{ data: mesasRaw }, { data: pedidosAbiertos }, { data: config }] = await Promise.all([
    supabase
      .from('mesas')
      .select(
        'id, numero, nombre, pos_x, pos_y, rotacion, forma, tamano, capacidad, asientos_horario, areas(nombre)',
      )
      .eq('activa', true)
      .order('numero'),
    supabase.from('pedidos').select('id, mesa_id, created_at').eq('estado', 'abierto').not('mesa_id', 'is', null),
    supabase
      .from('config_sistema')
      .select('alerta_mesa_sin_atender, alerta_mesa_sin_atender_minutos')
      .eq('id', 1)
      .single(),
  ])

  const pedidoIdsAbiertos = (pedidosAbiertos ?? []).map((p) => p.id)
  const [{ data: pedidoMesasRaw }, { data: subpedidosRaw }] = await Promise.all([
    pedidoIdsAbiertos.length > 0
      ? supabase.from('pedido_mesas').select('mesa_id, pedido_id, orden').in('pedido_id', pedidoIdsAbiertos)
      : Promise.resolve({ data: [] as { mesa_id: number; pedido_id: number; orden: number }[] }),
    pedidoIdsAbiertos.length > 0
      ? supabase
          .from('subpedidos')
          .select('pedido_id, estado, silla_numero, pedido_productos(estado)')
          .in('pedido_id', pedidoIdsAbiertos)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : Promise.resolve({ data: [] as any[] }),
  ])

  // mesa_id → pedido que la ocupa, ya sea como principal o como satélite.
  const pedidoPorMesa = new Map<number, number>()
  const pedidoCreatedAtPorId = new Map<number, string>()
  for (const p of pedidosAbiertos ?? []) {
    if (p.mesa_id) pedidoPorMesa.set(p.mesa_id, p.id)
    pedidoCreatedAtPorId.set(p.id, p.created_at)
  }
  for (const pm of pedidoMesasRaw ?? []) {
    pedidoPorMesa.set(pm.mesa_id, pm.pedido_id)
  }

  // ── Ocupación de sillas + semáforo (mismo criterio que /mesas) ────────────
  const capacidadPorMesa = new Map((mesasRaw ?? []).map((m) => [m.id, m.capacidad ?? 1]))
  const sillasOcupadasPorPedido = new Map<number, number[]>()
  const algunoPagadoNoTodosPorPedido = new Map<number, boolean>()
  const tieneProductosPorPedido = new Map<number, boolean>()
  const subsPorPedido = new Map<number, { estado: string }[]>()
  for (const sub of subpedidosRaw ?? []) {
    if (sub.silla_numero !== null) {
      const arr = sillasOcupadasPorPedido.get(sub.pedido_id) ?? []
      arr.push(sub.silla_numero)
      sillasOcupadasPorPedido.set(sub.pedido_id, arr)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tieneAlgunoActivo = (sub.pedido_productos ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pp: any) => pp.estado === 'pendiente' || pp.estado === 'enviado',
    )
    if (tieneAlgunoActivo) tieneProductosPorPedido.set(sub.pedido_id, true)
    const arr = subsPorPedido.get(sub.pedido_id) ?? []
    arr.push({ estado: sub.estado })
    subsPorPedido.set(sub.pedido_id, arr)
  }
  for (const [pedidoId, subs] of subsPorPedido) {
    const algunoPagado = subs.some((s) => s.estado === 'pagado')
    const todosPagados = subs.every((s) => s.estado === 'pagado')
    algunoPagadoNoTodosPorPedido.set(pedidoId, algunoPagado && !todosPagados)
  }

  const ocupacionPorMesa = calcularOcupacionPorMesa({
    pedidos: (pedidosAbiertos ?? [])
      .filter((p): p is typeof p & { mesa_id: number } => p.mesa_id !== null)
      .map((p) => ({ id: p.id, mesaId: p.mesa_id })),
    pedidoMesas: (pedidoMesasRaw ?? []).map((pm) => ({
      pedidoId: pm.pedido_id,
      mesaId: pm.mesa_id,
      orden: pm.orden,
    })),
    capacidadPorMesa,
    sillasOcupadasPorPedido,
  })

  const mesas: MesaEditable[] = (mesasRaw ?? []).map((m) => {
    const pedidoActivoId = pedidoPorMesa.get(m.id) ?? null
    return {
      id: m.id,
      numero: m.numero,
      nombre: m.nombre,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      areaNombre: (m.areas as any)?.nombre ?? 'Sin área',
      forma: (m.forma as FormaMesa) ?? 'rectangulo',
      tamano: (m.tamano as TamanoMesa) ?? 'medio',
      rotacion: m.rotacion ?? 0,
      posX: m.pos_x,
      posY: m.pos_y,
      capacidad: m.capacidad,
      asientosHorario: m.asientos_horario ?? true,
      ocupadas: ocupacionPorMesa.get(m.id) ?? 0,
      pedidoActivoId,
      algunoPagadoNoTodos: pedidoActivoId ? algunoPagadoNoTodosPorPedido.get(pedidoActivoId) ?? false : false,
      tieneProductos: pedidoActivoId ? tieneProductosPorPedido.get(pedidoActivoId) ?? false : false,
      pedidoCreatedAt: pedidoActivoId ? pedidoCreatedAtPorId.get(pedidoActivoId) ?? null : null,
    }
  })

  return (
    <LienzoMesasEditor
      mesas={mesas}
      alertaActiva={config?.alerta_mesa_sin_atender ?? true}
      alertaMinutos={config?.alerta_mesa_sin_atender_minutos ?? 10}
    />
  )
}
