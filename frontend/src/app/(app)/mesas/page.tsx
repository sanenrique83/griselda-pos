import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'
import { MesasShell } from '@/components/mesas/MesasShell'

// Tipos exportados para que los componentes cliente los importen
export type MesaUI = {
  id: number
  numero: number
  nombre: string | null
  capacidad: number | null
  area_nombre: string
  pos_x: number | null
  pos_y: number | null
  rotacion: number
  forma: FormaMesa
  tamano: TamanoMesa
  pedido_activo: {
    id: number
    created_at: string
    num_comensales: number
    mesero_nombre: string
  } | null
}

export type GrupoArea = {
  area_nombre: string
  mesas: MesaUI[]
}

export default async function MesasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Turno activo
  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()

  // Mesas activas con su área
  const { data: mesasRaw } = await supabase
    .from('mesas')
    .select('id, numero, nombre, capacidad, area_id, pos_x, pos_y, rotacion, forma, tamano, areas(nombre)')
    .eq('activa', true)
    .order('numero')

  // Pedidos abiertos en mesa (no llevar) — mesa "principal" de cada uno
  const { data: pedidosAbiertos } = await supabase
    .from('pedidos')
    .select('id, mesa_id, created_at, num_comensales, mesero_id')
    .eq('estado', 'abierto')
    .not('mesa_id', 'is', null)

  // Mesas satélite unidas de forma persistente (unirMesas) a esos mismos
  // pedidos abiertos — una mesa satélite ya no tiene su propio pedidos.mesa_id
  // (su pedido original se cerró al unirse), así que sin esto se vería como
  // libre pese a seguir ocupada como parte del pedido destino.
  const pedidoIdsAbiertos = (pedidosAbiertos ?? []).map((p) => p.id)
  const { data: pedidoMesasRaw } =
    pedidoIdsAbiertos.length > 0
      ? await supabase.from('pedido_mesas').select('mesa_id, pedido_id').in('pedido_id', pedidoIdsAbiertos)
      : { data: [] as { mesa_id: number; pedido_id: number }[] }

  // Nombres de los meseros en esos pedidos
  const meseroIds = [...new Set((pedidosAbiertos ?? []).map((p) => p.mesero_id))]
  const { data: perfiles } = meseroIds.length
    ? await supabase.from('perfiles').select('id, nombre').in('id', meseroIds)
    : { data: [] }

  const perfilMap = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string]))
  const pedidoPorId = new Map((pedidosAbiertos ?? []).map((p) => [p.id, p]))

  // mesa_id → pedido que la ocupa, ya sea como principal o como satélite.
  // Dos mesas comparten el mismo pedido_activo.id cuando están unidas — esa
  // es la clave de agrupación que usa el conector visual en PlanoMesas.
  const pedidoMap = new Map((pedidosAbiertos ?? []).map((p) => [p.mesa_id as number, p]))
  for (const pm of pedidoMesasRaw ?? []) {
    const pedido = pedidoPorId.get(pm.pedido_id)
    if (pedido) pedidoMap.set(pm.mesa_id, pedido)
  }

  // Deduplicar por id (PostgREST puede devolver la misma fila dos veces con embeds)
  const mesasUnicas = [
    ...new Map((mesasRaw ?? []).map((m) => [m.id, m])).values(),
  ]

  // Agrupar mesas por área (vista de lista) y armar lista plana (vista de mapa)
  const gruposMap = new Map<string, MesaUI[]>()
  const mesas: MesaUI[] = []

  for (const mesa of mesasUnicas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const area_nombre = (mesa.areas as any)?.nombre ?? 'Sin área'
    const pedido = pedidoMap.get(mesa.id)

    const mesaUI: MesaUI = {
      id: mesa.id,
      numero: mesa.numero,
      nombre: mesa.nombre,
      capacidad: mesa.capacidad,
      area_nombre,
      pos_x: mesa.pos_x,
      pos_y: mesa.pos_y,
      rotacion: mesa.rotacion ?? 0,
      forma: (mesa.forma as FormaMesa) ?? 'rectangulo',
      tamano: (mesa.tamano as TamanoMesa) ?? 'medio',
      pedido_activo: pedido
        ? {
            id: pedido.id,
            created_at: pedido.created_at,
            num_comensales: pedido.num_comensales,
            mesero_nombre: perfilMap.get(pedido.mesero_id) ?? 'Mesero',
          }
        : null,
    }

    if (!gruposMap.has(area_nombre)) gruposMap.set(area_nombre, [])
    gruposMap.get(area_nombre)!.push(mesaUI)
    mesas.push(mesaUI)
  }

  const grupos: GrupoArea[] = Array.from(gruposMap.entries()).map(
    ([area_nombre, mesas]) => ({ area_nombre, mesas }),
  )

  const hayMapa = mesas.some((m) => m.pos_x !== null && m.pos_y !== null)

  return <MesasShell grupos={grupos} mesas={mesas} hayMapa={hayMapa} turnoId={turno?.id ?? null} />
}
