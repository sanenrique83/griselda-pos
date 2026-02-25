import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapaMesas from '@/components/mesas/MapaMesas'

// Tipos exportados para que los componentes cliente los importen
export type MesaUI = {
  id: number
  numero: number
  nombre: string | null
  capacidad: number | null
  area_nombre: string
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
    .select('id, numero, nombre, capacidad, area_id, areas(nombre)')
    .eq('activa', true)
    .order('numero')

  // Pedidos abiertos en mesa (no llevar)
  const { data: pedidosAbiertos } = await supabase
    .from('pedidos')
    .select('id, mesa_id, created_at, num_comensales, mesero_id')
    .eq('estado', 'abierto')
    .not('mesa_id', 'is', null)

  // Nombres de los meseros en esos pedidos
  const meseroIds = [...new Set((pedidosAbiertos ?? []).map((p) => p.mesero_id))]
  const { data: perfiles } = meseroIds.length
    ? await supabase.from('perfiles').select('id, nombre').in('id', meseroIds)
    : { data: [] }

  const perfilMap = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string]))
  const pedidoMap = new Map((pedidosAbiertos ?? []).map((p) => [p.mesa_id as number, p]))

  // Deduplicar por id (PostgREST puede devolver la misma fila dos veces con embeds)
  const mesasUnicas = [
    ...new Map((mesasRaw ?? []).map((m) => [m.id, m])).values(),
  ]

  // Agrupar mesas por área
  const gruposMap = new Map<string, MesaUI[]>()

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
  }

  const grupos: GrupoArea[] = Array.from(gruposMap.entries()).map(
    ([area_nombre, mesas]) => ({ area_nombre, mesas }),
  )

  return <MapaMesas grupos={grupos} turnoId={turno?.id ?? null} />
}
