'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { liberarUnaMesaSatelite } from '@/lib/mesasSatelite'

// ─── Liberar mesas satélite (pedido_mesas) de un pedido que se cierra ────────
// Mesas unidas vía unirMesas() se quedan 'ocupada' hasta que el pedido al que
// se unieron se cobra por completo o se anula. Se usa tanto en cobrarPedido
// (pago completo) como en anularPedido — mismo criterio que la mesa principal:
// temporal → se borra (nuleando también la fila de pedido_mesas y cualquier
// pedido histórico que aún la referencie como mesa_id, p. ej. el pedido
// original de "Compartir mesa" antes de unirse, para no violar el FK).
//
// Para mesas normales NO se borra la fila de pedido_mesas — queda como
// registro histórico de qué pedido la ocupó, igual que pedidos.mesa_id nunca
// se limpia al cerrar una mesa normal. reabrir_pedido() la necesita: si este
// pedido se reabre después, así sabe qué mesas satélite debe volver a ocupar.
//
// Si la mesa se movió visualmente al unirse por arrastre (pos_x_original no
// nulo — ver unirMesas/unirMesaLibreAOcupada/abrirPedidoMesaCombinada), se
// regresa a esa posición antes de liberarla. Si nunca se movió (unión vía
// SheetUnirMesa, sin mapa de por medio), esas columnas quedan NULL y no hay
// nada que restaurar.
async function liberarMesasSatelite(supabase: SupabaseClient, pedidoId: number): Promise<void> {
  const { data: satelites } = await supabase
    .from('pedido_mesas')
    .select('mesa_id, pos_x_original, pos_y_original, rotacion_original')
    .eq('pedido_id', pedidoId)

  const mesaIds = (satelites ?? []).map((s) => s.mesa_id)
  if (mesaIds.length === 0) return

  const { data: mesasInfo } = await supabase.from('mesas').select('id, temporal').in('id', mesaIds)
  const origPorMesa = new Map((satelites ?? []).map((s) => [s.mesa_id, s]))

  // Nota: estos updates/deletes corren DESPUÉS de que el pedido ya se cerró
  // (cobro completo o anulación) — el negocio ya considera la operación
  // completa en ese momento, así que un fallo aquí no debe convertirse en un
  // error visible para el cajero (revertiría una acción que ya sucedió). Se
  // loguea server-side para poder detectar mesas que se quedaron "atoradas"
  // sin depender de que alguien lo reporte.
  for (const mesa of mesasInfo ?? []) {
    if (mesa.temporal) {
      const { error: pmErr } = await supabase.from('pedido_mesas').delete().eq('mesa_id', mesa.id)
      if (pmErr) {
        console.error('[liberarMesasSatelite] error borrando pedido_mesas:', {
          pedidoId,
          mesaId: mesa.id,
          error: pmErr.message,
        })
      }
    }
    const { error } = await liberarUnaMesaSatelite(supabase, mesa.id, mesa.temporal, origPorMesa.get(mesa.id))
    if (error) {
      console.error('[liberarMesasSatelite] error liberando mesa:', {
        pedidoId,
        mesaId: mesa.id,
        error,
      })
    }
  }
}

// ─── Anular pedido (sin movimiento de caja) ───────────────────────────────────
export async function anularPedido(
  pedidoId: number,
  mesaId: number | null,
): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const { error: pedErr } = await supabase
    .from('pedidos')
    .update({ estado: 'cerrado', cerrado_en: new Date().toISOString() })
    .eq('id', pedidoId)

  if (pedErr) return { error: 'Error al anular el pedido.' }

  if (mesaId) {
    const { data: mesa } = await supabase
      .from('mesas')
      .select('temporal')
      .eq('id', mesaId)
      .single()

    if (mesa?.temporal) {
      // Nullear FK en el pedido antes de eliminar la mesa para evitar constraint violation
      const { error: nullErr } = await supabase.from('pedidos').update({ mesa_id: null }).eq('id', pedidoId)
      if (nullErr) {
        console.error('[anularPedido] error limpiando mesa_id en pedidos:', {
          pedidoId,
          mesaId,
          error: nullErr.message,
        })
      }
      const { error: delErr } = await supabase.from('mesas').delete().eq('id', mesaId)
      if (delErr) {
        console.error('[anularPedido] error borrando mesa temporal:', {
          pedidoId,
          mesaId,
          error: delErr.message,
        })
      }
    } else {
      const { error: libErr } = await supabase.from('mesas').update({ estado: 'libre' }).eq('id', mesaId)
      if (libErr) {
        console.error('[anularPedido] error liberando mesa:', { pedidoId, mesaId, error: libErr.message })
      }
    }
  }

  await liberarMesasSatelite(supabase, pedidoId)

  redirect('/mesas')
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'

export type PagoInput = {
  metodo: MetodoPago
  monto: number
  referencia?: string | null
}

type SubpedidoMonto = {
  id: number
  monto: number
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function cobrarPedido(data: {
  pedidoId: number
  turnoId: number
  mesaId: number | null
  subpedidos: SubpedidoMonto[]
  totalCobrado: number   // monto del negocio SIN propina
  propina: number        // propina (va a meseros, no entra al cuadre de caja)
  pagos: PagoInput[]     // montos físicos por método (incluyen propina)
  efectivoRecibido: number | null
  cambio: number | null
  descuentoPct?: number
  descuentoMonto?: number
}): Promise<{ error: string } | { ok: true; redirectTo: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Validar que los pagos cubran el total físico (negocio + propina)
  const totalFisico = data.totalCobrado + data.propina
  const sumaPagos = data.pagos.reduce((s, p) => s + p.monto, 0)
  if (sumaPagos < totalFisico - 0.01) {
    return { error: 'El monto ingresado no cubre el total del pedido.' }
  }

  // ── 0. Registrar descuento si aplica ──────────────────────────────────────
  if (data.descuentoPct && data.descuentoPct > 0 && data.descuentoMonto && user) {
    await supabase.from('descuentos').insert({
      pedido_id: data.pedidoId,
      usuario_id: user.id,
      tipo: 'porcentaje',
      valor: data.descuentoPct,
      monto_calculado: data.descuentoMonto,
      motivo: 'Descuento en cobro',
    })
  }

  // ── 1. Movimiento de caja ──────────────────────────────────────────────────
  // Propina en efectivo (se retira físicamente del cajón) vs. en tarjeta/
  // transferencia (queda en la terminal, nunca toca el cajón). En pago mixto
  // se reparte proporcional al monto físico de cada método.
  const montoEfectivo = data.pagos
    .filter((p) => p.metodo === 'efectivo')
    .reduce((s, p) => s + p.monto, 0)
  const propinaEfectivo =
    totalFisico > 0
      ? Math.round(((data.propina * montoEfectivo) / totalFisico) * 100) / 100
      : 0
  const propinaTarjeta = Math.round((data.propina - propinaEfectivo) * 100) / 100

  const { data: mov, error: movErr } = await supabase
    .from('movimientos_caja')
    .insert({
      turno_id: data.turnoId,
      tipo: 'cobro',
      monto: data.totalCobrado,
      propina: data.propina,
      propina_efectivo: propinaEfectivo,
      propina_tarjeta: propinaTarjeta,
      efectivo_recibido: data.efectivoRecibido,
      cambio: data.cambio,
      notas: null,
    })
    .select('id')
    .single()

  if (movErr || !mov) {
    console.error('[cobrarPedido] error movimiento_caja:', movErr)
    return { error: 'Error al registrar el movimiento de caja.' }
  }

  // ── 2. Registrar pagos (uno por método) ────────────────────────────────────
  const { error: pagosErr } = await supabase
    .from('pagos')
    .insert(
      data.pagos.map((p) => ({
        movimiento_id: mov.id,
        metodo_pago: p.metodo,
        monto: p.monto,
        referencia: p.referencia ?? null,
      })),
    )

  if (pagosErr) return { error: 'Error al registrar los métodos de pago.' }

  // ── 3. Vincular cobro a cada subpedido (distribución proporcional) ─────────
  if (data.subpedidos.length > 0) {
    const totalBase = data.subpedidos.reduce((s, sp) => s + sp.monto, 0)
    const { error: cobrosErr } = await supabase
      .from('cobro_subpedidos')
      .insert(
        data.subpedidos.map((sp) => ({
          movimiento_id: mov.id,
          subpedido_id: sp.id,
          monto_aplicado:
            totalBase > 0
              ? Math.round((sp.monto / totalBase) * data.totalCobrado * 100) / 100
              : data.totalCobrado / data.subpedidos.length,
        })),
      )

    if (cobrosErr) return { error: 'Error al vincular el cobro a los comensales.' }
  }

  // ── 3.5 Descontar inventario de ítems que nunca se enviaron a cocina ───────
  // Flujo real del negocio: ítems simples se comunican de viva voz y nunca
  // pasan por "Enviar a cocina" (pedido_productos sigue en 'pendiente'). Sin
  // este paso, cobrar y cerrar el pedido nunca dispara aplicar_consumo_receta()
  // para esos ítems — se cobran pero jamás descuentan inventario. Acotado a
  // los subpedido_id que se están cobrando AHORA (no todo el pedido): "Uno
  // paga varios" puede cobrar solo una parte de los comensales.
  const { error: enviarErr } = await supabase.rpc('enviar_pendientes_de_subpedidos', {
    p_subpedido_ids: data.subpedidos.map((sp) => sp.id),
  })

  if (enviarErr) {
    console.error('[cobrarPedido] error enviar_pendientes_de_subpedidos:', enviarErr)
    return { error: 'Error al descontar el inventario de los ítems del cobro.' }
  }

  // ── 4. Marcar subpedidos cobrados como pagados ────────────────────────────
  const { error: subErr } = await supabase
    .from('subpedidos')
    .update({ estado: 'pagado' })
    .in(
      'id',
      data.subpedidos.map((sp) => sp.id),
    )

  if (subErr) return { error: 'Error al actualizar los comensales.' }

  // ── 5. Verificar si quedan subpedidos activos ─────────────────────────────
  const { count: activos } = await supabase
    .from('subpedidos')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', data.pedidoId)
    .eq('estado', 'activo')

  if ((activos ?? 0) > 0) {
    // Pago parcial: quedan comensales sin pagar → no cerrar pedido
    revalidatePath(`/cobro/${data.pedidoId}`)
    return { ok: true as const, redirectTo: `/cobro/${data.pedidoId}` }
  }

  // ── 6. Cerrar el pedido (todos pagados) ───────────────────────────────────
  const { error: pedErr } = await supabase
    .from('pedidos')
    .update({ estado: 'cerrado', cerrado_en: new Date().toISOString() })
    .eq('id', data.pedidoId)

  if (pedErr) return { error: 'Error al cerrar el pedido.' }

  // ── 7. Liberar o eliminar la mesa ─────────────────────────────────────────
  if (data.mesaId) {
    const { data: mesa, error: mesaSelErr } = await supabase
      .from('mesas')
      .select('temporal')
      .eq('id', data.mesaId)
      .single()

    console.log('[cobrarPedido] mesa SELECT:', { mesaId: data.mesaId, mesa, err: mesaSelErr?.message ?? null })

    if (mesa?.temporal) {
      // Nullear FK — requiere CHECK relajado: permite null cuando estado='cerrado'
      const { error: nullErr } = await supabase
        .from('pedidos')
        .update({ mesa_id: null })
        .eq('id', data.pedidoId)
      console.log('[cobrarPedido] UPDATE mesa_id=null:', nullErr?.message ?? 'ok')
      const { error: delErr } = await supabase.from('mesas').delete().eq('id', data.mesaId)
      console.log('[cobrarPedido] DELETE mesa temporal:', delErr?.message ?? 'ok')
    } else {
      const { error: libErr } = await supabase.from('mesas').update({ estado: 'libre' }).eq('id', data.mesaId)
      if (libErr) {
        console.error('[cobrarPedido] error liberando mesa:', {
          pedidoId: data.pedidoId,
          mesaId: data.mesaId,
          error: libErr.message,
        })
      }
    }
  }

  // ── 8. Liberar las mesas satélite unidas a este pedido (pedido_mesas) ─────
  await liberarMesasSatelite(supabase, data.pedidoId)

  revalidatePath('/mesas')
  revalidatePath('/pedidos')
  return { ok: true as const, redirectTo: '/mesas' }
}
