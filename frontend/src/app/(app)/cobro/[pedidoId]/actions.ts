'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ─── Anular pedido (solo si el total es $0) ───────────────────────────────
// Antes: solo cerraba pedido + liberaba mesa, sin verificar nada server-side
// (el gate de "solo si total=$0" vivía únicamente en CobroShell.tsx,
// mostrarAnular). Ahora vía anular_pedido_seguro() (SECURITY DEFINER) —
// migración 20260801000031 — que sí valida el total real del pedido antes
// de cerrarlo, además de liberar mesa/mesas satélite en la misma función.
export async function anularPedido(
  pedidoId: number,
  mesaId: number | null,
): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('anular_pedido_seguro', {
    p_pedido_id: pedidoId,
    p_mesa_id: mesaId,
  })

  if (error) {
    console.error('[anularPedido] error RPC anular_pedido_seguro:', error)
    return { error: error.message || 'Error al anular el pedido.' }
  }

  redirect('/mesas')
}

// ─── Marcar precuenta impresa ──────────────────────────────────────────────
// Llamada desde CobroShell tras un imprimirTicket({ escenario: 'precuenta' })
// exitoso. Se limpia (NULL) en cobrarPedido() en cuanto ocurre un cobro real.
export async function marcarPrecuentaImpresa(pedidoId: number): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('pedidos')
    .update({ precuenta_impresa_en: new Date().toISOString() })
    .eq('id', pedidoId)

  if (error) return { error: 'Error al registrar la precuenta.' }

  revalidatePath('/mesas')
  revalidatePath('/mas/mapa-mesas')
  return { ok: true }
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
  // El valor tal cual lo capturó el mesero — el % o el monto fijo en pesos,
  // según descuentoTipo (tipo_descuento ya soporta 'monto_fijo' desde el
  // schema inicial, columna `valor` documentada como "el porcentaje o monto
  // ingresado" — no hizo falta ninguna migración para esto).
  descuentoValor?: number
  descuentoTipo?: 'porcentaje' | 'monto_fijo'
  descuentoMonto?: number
}): Promise<{ error: string } | { ok: true; redirectTo: string }> {
  const supabase = await createClient()

  // Toda la lógica (permiso cobro_solo_admin, permiso descuentos_mesero,
  // validación de pagos, movimiento+pagos+cobro_subpedidos, descuento de
  // inventario, cierre de subpedidos/pedido, liberación de mesa/satélite)
  // vive ahora en cobrar_pedido_seguro() — SECURITY DEFINER, migración
  // 20260801000031 — en una sola transacción atómica en vez de repartida en
  // ~8 llamadas separadas desde aquí.
  const { data: result, error } = await supabase.rpc('cobrar_pedido_seguro', {
    p_pedido_id: data.pedidoId,
    p_turno_id: data.turnoId,
    p_mesa_id: data.mesaId,
    p_subpedidos: data.subpedidos.map((sp) => ({ id: sp.id, monto: sp.monto })),
    p_total_cobrado: data.totalCobrado,
    p_propina: data.propina,
    p_pagos: data.pagos.map((p) => ({ metodo: p.metodo, monto: p.monto, referencia: p.referencia ?? null })),
    p_efectivo_recibido: data.efectivoRecibido,
    p_cambio: data.cambio,
    p_descuento_valor: data.descuentoValor ?? null,
    p_descuento_tipo: data.descuentoTipo ?? null,
    p_descuento_monto: data.descuentoMonto ?? null,
  })

  if (error) {
    console.error('[cobrarPedido] error RPC cobrar_pedido_seguro:', error)
    return { error: error.message || 'Error al procesar el cobro.' }
  }

  const pedidoCerrado = (result as { pedido_cerrado?: boolean } | null)?.pedido_cerrado === true

  if (!pedidoCerrado) {
    // Pago parcial: quedan comensales sin pagar → no cerrar pedido
    revalidatePath(`/cobro/${data.pedidoId}`)
    return { ok: true as const, redirectTo: `/cobro/${data.pedidoId}` }
  }

  revalidatePath('/mesas')
  revalidatePath('/pedidos')
  return { ok: true as const, redirectTo: '/mesas' }
}
