'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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
      await supabase.from('pedidos').update({ mesa_id: null }).eq('id', pedidoId)
      await supabase.from('mesas').delete().eq('id', mesaId)
    } else {
      await supabase.from('mesas').update({ estado: 'libre' }).eq('id', mesaId)
    }
  }

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
  totalCobrado: number
  pagos: PagoInput[]
  efectivoRecibido: number | null
  cambio: number | null
}): Promise<{ error: string } | void> {
  const supabase = await createClient()

  // Validar que la suma de pagos cubra el total
  const sumaPagos = data.pagos.reduce((s, p) => s + p.monto, 0)
  if (sumaPagos < data.totalCobrado - 0.01) {
    return { error: 'El monto ingresado no cubre el total del pedido.' }
  }

  // ── 1. Movimiento de caja ──────────────────────────────────────────────────
  const { data: mov, error: movErr } = await supabase
    .from('movimientos_caja')
    .insert({
      turno_id: data.turnoId,
      tipo: 'cobro',
      monto: data.totalCobrado,
      efectivo_recibido: data.efectivoRecibido,
      cambio: data.cambio,
      notas: null,
    })
    .select('id')
    .single()

  if (movErr || !mov) return { error: 'Error al registrar el movimiento de caja.' }

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
    redirect(`/cobro/${data.pedidoId}`)
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
      await supabase.from('mesas').update({ estado: 'libre' }).eq('id', data.mesaId)
    }
  }

  redirect('/mesas')
}
