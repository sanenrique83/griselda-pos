import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'
import { LienzoMesasEditor } from '@/components/mapa-mesas/LienzoMesasEditor'

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
  // Pedido abierto que ocupa esta mesa (como principal o como satélite unida
  // vía pedido_mesas) — agrupa mesas unidas para el conector visual.
  pedidoActivoId: number | null
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

  const [{ data: mesasRaw }, { data: pedidosAbiertos }] = await Promise.all([
    supabase
      .from('mesas')
      .select('id, numero, nombre, pos_x, pos_y, rotacion, forma, tamano, areas(nombre)')
      .eq('activa', true)
      .order('numero'),
    supabase.from('pedidos').select('id, mesa_id').eq('estado', 'abierto').not('mesa_id', 'is', null),
  ])

  const pedidoIdsAbiertos = (pedidosAbiertos ?? []).map((p) => p.id)
  const { data: pedidoMesasRaw } =
    pedidoIdsAbiertos.length > 0
      ? await supabase.from('pedido_mesas').select('mesa_id, pedido_id').in('pedido_id', pedidoIdsAbiertos)
      : { data: [] as { mesa_id: number; pedido_id: number }[] }

  // mesa_id → pedido que la ocupa, ya sea como principal o como satélite.
  const pedidoPorMesa = new Map<number, number>()
  for (const p of pedidosAbiertos ?? []) {
    if (p.mesa_id) pedidoPorMesa.set(p.mesa_id, p.id)
  }
  for (const pm of pedidoMesasRaw ?? []) {
    pedidoPorMesa.set(pm.mesa_id, pm.pedido_id)
  }

  const mesas: MesaEditable[] = (mesasRaw ?? []).map((m) => ({
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
    pedidoActivoId: pedidoPorMesa.get(m.id) ?? null,
  }))

  return <LienzoMesasEditor mesas={mesas} />
}
