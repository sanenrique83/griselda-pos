import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ElegirSillaInicialShell } from '@/components/pos/ElegirSillaInicialShell'

export default async function NuevaPosPage({
  params,
}: {
  params: Promise<{ mesaId: string }>
}) {
  const { mesaId: mesaIdStr } = await params
  const mesaId = Number(mesaIdStr)
  if (isNaN(mesaId)) redirect('/mesas')

  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Turno activo ──────────────────────────────────────────────────────────
  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) redirect('/mesas')

  // ── Mesa (geometría para el diagrama de sillas) ────────────────────────────
  const { data: mesa } = await supabase
    .from('mesas')
    .select('id, numero, nombre, estado, capacidad, forma, tamano, rotacion, asientos_horario')
    .eq('id', mesaId)
    .single()

  if (!mesa) redirect('/mesas')

  // Si la mesa ya tiene un pedido abierto, redirigir a ese pedido
  const { data: pedidoExistente } = await supabase
    .from('pedidos')
    .select('id')
    .eq('mesa_id', mesaId)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (pedidoExistente) {
    redirect(`/pos/${pedidoExistente.id}`)
  }

  const mesaLabel = mesa.nombre ?? `Mesa ${mesa.numero}`

  return (
    <ElegirSillaInicialShell
      mesaId={mesaId}
      turnoId={turno.id}
      mesaLabel={mesaLabel}
      capacidad={mesa.capacidad ?? null}
      forma={mesa.forma ?? 'rectangulo'}
      tamano={mesa.tamano ?? 'medio'}
      rotacion={mesa.rotacion ?? 0}
      asientosHorario={mesa.asientos_horario ?? true}
    />
  )
}
