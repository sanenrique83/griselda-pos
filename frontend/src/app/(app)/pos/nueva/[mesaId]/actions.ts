'use server'

import { createClient } from '@/lib/supabase/server'

type Err = { error: string }

// ─── Abrir mesa con silla del comensal 1 ya elegida ────────────────────────────
// Reemplaza al flujo "draft" (agregar producto antes de que exista pedido):
// ahora la única decisión manual de todo el flujo de sillas —en qué silla se
// sienta el comensal 1— se hace ANTES de crear nada, en la pantalla de
// elegir silla (ver ElegirSillaInicialShell). Al confirmar, esto crea el
// pedido + el primer comensal con esa silla ya asignada, y el mesero
// aterriza directo en Menú (pedido ya real, no draft).
export async function abrirPedidoMesa(
  mesaId: number,
  turnoId: number,
  sillaElegida: number,
): Promise<{ pedidoId: number } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // Protección contra condición de carrera (dos meseros tocando la misma
  // mesa casi simultáneo, ej. en ElegirSillaInicialShell antes de que la
  // pantalla del segundo se haya refrescado): si ya hay un pedido abierto en
  // esta mesa —como mesa principal o como satélite unida vía pedido_mesas—
  // se usa ese en vez de crear uno duplicado. La silla elegida por el
  // segundo mesero se descarta en ese caso (la mesa ya tiene su comensal 1).
  const { data: pedidoExistente } = await supabase
    .from('pedidos')
    .select('id')
    .eq('mesa_id', mesaId)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (pedidoExistente) return { pedidoId: pedidoExistente.id }

  const { data: satelites } = await supabase
    .from('pedido_mesas')
    .select('pedido_id, pedidos!inner(estado)')
    .eq('mesa_id', mesaId)
    .eq('pedidos.estado', 'abierto')
    .limit(1)

  if (satelites && satelites.length > 0) return { pedidoId: satelites[0].pedido_id }

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      turno_id: turnoId,
      mesa_id: mesaId,
      mesero_id: user.id,
      tipo: 'mesa',
    })
    .select('id')
    .single()

  if (pedidoErr || !pedido) return { error: 'Error al crear el pedido.' }

  const { error: subErr } = await supabase
    .from('subpedidos')
    .insert({
      pedido_id: pedido.id,
      mesero_id: user.id,
      comensal_numero: 1,
      silla_numero: sillaElegida,
    })

  if (subErr) return { error: 'Error al crear el comensal.' }

  await supabase.rpc('set_estado_mesa', {
    p_mesa_id: mesaId,
    p_estado: 'ocupada',
  })

  return { pedidoId: pedido.id }
}

// ─── Abrir mesa combinada (2 mesas libres unidas desde el arrastre) ────────────
// Caso "arrastrar una mesa libre cerca de otra mesa libre" en
// /mas/mapa-mesas: en vez de crear un pedido por mesa, se crea UNO SOLO en la
// mesa "principal" (la que quedó fija en el mapa) con la mesa arrastrada ya
// registrada como satélite (pedido_mesas, orden=2) desde el momento cero —
// nunca pasan por unirMesas() porque nunca existieron como pedidos separados.
// El picker de silla (ver ElegirSillaInicialShell) usa la capacidad
// combinada de ambas mesas para el comensal 1.
export async function abrirPedidoMesaCombinada(
  mesaPrincipalId: number,
  mesaSateliteId: number,
  turnoId: number,
  sillaElegida: number,
  reposicionSatelite: { x: number; y: number; rotacion: number } | null,
): Promise<{ pedidoId: number } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // Misma protección contra condición de carrera que abrirPedidoMesa: si ya
  // hay un pedido en la principal (como principal o como satélite de otro),
  // se usa ese en vez de crear uno duplicado.
  const { data: pedidoExistente } = await supabase
    .from('pedidos')
    .select('id')
    .eq('mesa_id', mesaPrincipalId)
    .eq('estado', 'abierto')
    .maybeSingle()
  if (pedidoExistente) return { pedidoId: pedidoExistente.id }

  const { data: satelitesExistentes } = await supabase
    .from('pedido_mesas')
    .select('pedido_id, pedidos!inner(estado)')
    .eq('mesa_id', mesaPrincipalId)
    .eq('pedidos.estado', 'abierto')
    .limit(1)
  if (satelitesExistentes && satelitesExistentes.length > 0) {
    return { pedidoId: satelitesExistentes[0].pedido_id }
  }

  // La mesa satélite tampoco debe estar ya ocupada por otro lado.
  const { data: mesaSatelite } = await supabase
    .from('mesas')
    .select('estado, temporal, pos_x, pos_y, rotacion')
    .eq('id', mesaSateliteId)
    .single()
  if (!mesaSatelite) return { error: 'Mesa satélite no encontrada.' }
  if (mesaSatelite.estado === 'ocupada') return { error: 'La otra mesa ya está ocupada.' }

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      turno_id: turnoId,
      mesa_id: mesaPrincipalId,
      mesero_id: user.id,
      tipo: 'mesa',
    })
    .select('id')
    .single()
  if (pedidoErr || !pedido) return { error: 'Error al crear el pedido.' }

  const { error: subErr } = await supabase
    .from('subpedidos')
    .insert({
      pedido_id: pedido.id,
      mesero_id: user.id,
      comensal_numero: 1,
      silla_numero: sillaElegida,
    })
  if (subErr) return { error: 'Error al crear el comensal.' }

  const guardaOriginal = !mesaSatelite.temporal && !!reposicionSatelite

  const { error: pmError } = await supabase.from('pedido_mesas').insert({
    pedido_id: pedido.id,
    mesa_id: mesaSateliteId,
    orden: 2,
    ...(guardaOriginal
      ? {
          pos_x_original: mesaSatelite.pos_x,
          pos_y_original: mesaSatelite.pos_y,
          rotacion_original: mesaSatelite.rotacion,
        }
      : {}),
  })
  if (pmError) return { error: 'Error al unir la mesa satélite.' }

  await supabase.rpc('set_estado_mesa', { p_mesa_id: mesaPrincipalId, p_estado: 'ocupada' })
  await supabase.rpc('set_estado_mesa', { p_mesa_id: mesaSateliteId, p_estado: 'ocupada' })

  if (guardaOriginal) {
    await supabase
      .from('mesas')
      .update({
        pos_x: reposicionSatelite!.x,
        pos_y: reposicionSatelite!.y,
        rotacion: reposicionSatelite!.rotacion,
      })
      .eq('id', mesaSateliteId)
  }

  return { pedidoId: pedido.id }
}

