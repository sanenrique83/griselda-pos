'use server'

import { createClient } from '@/lib/supabase/server'

type Err = { error: string }

// ─── Crear pedido + agregar producto (modo estándar) ──────────────────────────
export async function crearPedidoYAgregarProducto(data: {
  mesaId: number
  turnoId: number
  productoId: number
  precioUnit: number
  cantidad: number
  notas: string | null
  opciones: { opcionId: number; precioExtra: number }[]
}): Promise<{ pedidoId: number } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // Crear pedido
  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      turno_id: data.turnoId,
      mesa_id: data.mesaId,
      mesero_id: user.id,
      tipo: 'mesa',
    })
    .select('id')
    .single()

  if (pedidoErr || !pedido) return { error: 'Error al crear el pedido.' }

  // Primer comensal
  const { data: sub, error: subErr } = await supabase
    .from('subpedidos')
    .insert({
      pedido_id: pedido.id,
      mesero_id: user.id,
      comensal_numero: 1,
    })
    .select('id')
    .single()

  if (subErr || !sub) return { error: 'Error al crear el comensal.' }

  // Marcar mesa como ocupada
  await supabase.rpc('set_estado_mesa', {
    p_mesa_id: data.mesaId,
    p_estado: 'ocupada',
  })

  // Agregar producto
  const { data: item, error: itemErr } = await supabase
    .from('pedido_productos')
    .insert({
      subpedido_id: sub.id,
      producto_id: data.productoId,
      precio_unit: data.precioUnit,
      cantidad: data.cantidad,
      notas: data.notas,
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (itemErr || !item) return { error: 'Error al agregar el producto.' }

  if (data.opciones.length > 0) {
    const { error: opErr } = await supabase
      .from('pedido_producto_opciones')
      .insert(
        data.opciones.map((o) => ({
          pedido_producto_id: item.id,
          opcion_id: o.opcionId,
          precio_extra: o.precioExtra,
        })),
      )
    if (opErr) return { error: 'Error al guardar las opciones.' }
  }

  return { pedidoId: pedido.id }
}

// ─── Crear pedido + agregar productos rápidos ─────────────────────────────────
export async function crearPedidoYAgregarRapido(data: {
  mesaId: number
  turnoId: number
  productoId: number
  precioUnit: number
  guisados: { opcionId: number; cantidad: number; precioExtra: number }[]
}): Promise<{ pedidoId: number } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // Crear pedido
  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      turno_id: data.turnoId,
      mesa_id: data.mesaId,
      mesero_id: user.id,
      tipo: 'mesa',
    })
    .select('id')
    .single()

  if (pedidoErr || !pedido) return { error: 'Error al crear el pedido.' }

  // Primer comensal
  const { data: sub, error: subErr } = await supabase
    .from('subpedidos')
    .insert({
      pedido_id: pedido.id,
      mesero_id: user.id,
      comensal_numero: 1,
    })
    .select('id')
    .single()

  if (subErr || !sub) return { error: 'Error al crear el comensal.' }

  // Marcar mesa como ocupada
  await supabase.rpc('set_estado_mesa', {
    p_mesa_id: data.mesaId,
    p_estado: 'ocupada',
  })

  // Agregar guisados
  for (const g of data.guisados) {
    const { data: item, error: itemErr } = await supabase
      .from('pedido_productos')
      .insert({
        subpedido_id: sub.id,
        producto_id: data.productoId,
        precio_unit: data.precioUnit,
        cantidad: g.cantidad,
        estado: 'pendiente',
      })
      .select('id')
      .single()

    if (itemErr || !item) return { error: 'Error al agregar los tacos.' }

    await supabase.from('pedido_producto_opciones').insert({
      pedido_producto_id: item.id,
      opcion_id: g.opcionId,
      precio_extra: g.precioExtra,
    })
  }

  return { pedidoId: pedido.id }
}
