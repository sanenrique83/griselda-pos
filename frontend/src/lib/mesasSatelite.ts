import type { SupabaseClient } from '@supabase/supabase-js'

export type OrigenPosicion = {
  pos_x_original: number | null
  pos_y_original: number | null
  rotacion_original: number | null
}

// Libera UNA mesa satélite ya desvinculada de su fila en pedido_mesas — el
// caller es responsable de borrar esa fila (y de recalcular `orden` de las
// demás si aplica). Si la mesa es temporal (creada por "compartir mesa"),
// nunca tuvo una posición física a la que volver, así que se borra por
// completo (y se nulea cualquier pedido histórico que aún la referencie como
// mesa_id, para no violar el FK). Si es una mesa normal, se restaura a su
// posición pre-unión (pos_x_original/y/rotacion_original, si se movió al
// unirse) y se libera.
//
// Compartido por liberarMesasSatelite (cobro/[pedidoId]/actions.ts, cuando
// se cierra el pedido completo) y separarMesaUnida (pos/[pedidoId]/actions.ts,
// para separar una sola mesa de la cadena sin cerrar el pedido) — misma
// lógica, un solo lugar.
export async function liberarUnaMesaSatelite(
  supabase: SupabaseClient,
  mesaId: number,
  temporal: boolean,
  orig: OrigenPosicion | undefined,
): Promise<{ error: string | null }> {
  if (temporal) {
    await supabase.from('pedidos').update({ mesa_id: null }).eq('mesa_id', mesaId)
    const { error } = await supabase.from('mesas').delete().eq('id', mesaId)
    return { error: error?.message ?? null }
  }

  const patch: { estado: 'libre'; pos_x?: number | null; pos_y?: number | null; rotacion?: number | null } = {
    estado: 'libre',
  }
  if (orig?.pos_x_original !== null && orig?.pos_x_original !== undefined) {
    patch.pos_x = orig.pos_x_original
    patch.pos_y = orig.pos_y_original
    patch.rotacion = orig.rotacion_original
  }
  const { error } = await supabase.from('mesas').update(patch).eq('id', mesaId)
  return { error: error?.message ?? null }
}
