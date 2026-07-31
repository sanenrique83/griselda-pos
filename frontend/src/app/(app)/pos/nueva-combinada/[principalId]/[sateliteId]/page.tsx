import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ElegirSillaInicialShell } from '@/components/pos/ElegirSillaInicialShell'

// Paso previo a abrir un pedido combinado: arrastrar una mesa libre cerca de
// otra mesa libre en /mas/mapa-mesas dispara este picker en vez de ir directo
// a /pos/nueva/[mesaId] — el comensal 1 elige silla dentro de la capacidad
// COMBINADA de ambas mesas (ver ElegirSillaInicialShell + DiagramaSillasCadena).
// `principalId` es la mesa que quedó fija en el mapa; `sateliteId` es la que
// se arrastró (se unirá vía pedido_mesas, orden=2). x/y/r en la query son la
// posición ya calculada en el mapa para que la satélite quede pegada a la
// principal — se aplican recién al confirmar (abrirPedidoMesaCombinada).
export default async function NuevaPosCombinadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ principalId: string; sateliteId: string }>
  searchParams: Promise<{ x?: string; y?: string; r?: string }>
}) {
  const { principalId: pStr, sateliteId: sStr } = await params
  const { x, y, r } = await searchParams
  const principalId = Number(pStr)
  const sateliteId = Number(sStr)
  if (isNaN(principalId) || isNaN(sateliteId)) redirect('/mas/mapa-mesas')

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()
  if (!turno) redirect('/mas/mapa-mesas')

  const { data: mesasRaw } = await supabase
    .from('mesas')
    .select('id, numero, nombre, estado, capacidad, forma, tamano, rotacion, asientos_horario')
    .in('id', [principalId, sateliteId])

  const principal = mesasRaw?.find((m) => m.id === principalId)
  const satelite = mesasRaw?.find((m) => m.id === sateliteId)
  if (!principal || !satelite) redirect('/mas/mapa-mesas')

  // Si cualquiera de las dos ya se ocupó (condición de carrera) no tiene
  // sentido seguir con el picker — quien lo intente de nuevo verá el mapa
  // actualizado.
  if (principal.estado === 'ocupada' || satelite.estado === 'ocupada') {
    redirect('/mas/mapa-mesas')
  }

  const principalLabel = principal.nombre ?? `Mesa ${principal.numero}`
  const sateliteLabel = satelite.nombre ?? `Mesa ${satelite.numero}`

  const rx = Number(x)
  const ry = Number(y)
  const rr = Number(r)
  const reposicionSatelite =
    x !== undefined && y !== undefined && r !== undefined && !isNaN(rx) && !isNaN(ry) && !isNaN(rr)
      ? { x: rx, y: ry, rotacion: rr }
      : null

  return (
    <ElegirSillaInicialShell
      mesaId={principalId}
      turnoId={turno.id}
      mesaLabel={`${principalLabel} + ${sateliteLabel}`}
      capacidad={principal.capacidad ?? null}
      forma={principal.forma ?? 'rectangulo'}
      tamano={principal.tamano ?? 'medio'}
      rotacion={principal.rotacion ?? 0}
      asientosHorario={principal.asientos_horario ?? true}
      mesaSateliteId={sateliteId}
      capacidadSatelite={satelite.capacidad ?? 1}
      reposicionSatelite={reposicionSatelite}
    />
  )
}
