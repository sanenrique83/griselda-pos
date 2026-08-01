'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type ActionResult = { error: string } | undefined
type Err = { error: string }

export async function abrirPedidoLlevar(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) {
    return { error: 'No hay turno activo. Ve a Más → Turno para abrir uno.' }
  }

  const nombre       = (formData.get('nombre') as string)?.trim() || null
  const telefono     = (formData.get('telefono') as string)?.trim() || null
  const hora_recogida = (formData.get('hora_recogida') as string) || null

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      turno_id: turno.id,
      mesa_id: null,
      mesero_id: user.id,
      tipo: 'llevar',
      cliente_nombre: nombre,
      cliente_telefono: telefono,
      hora_recogida: hora_recogida,
    })
    .select('id')
    .single()

  if (error || !pedido) {
    return { error: 'Error al crear el pedido.' }
  }

  const { error: subErr } = await supabase.from('subpedidos').insert({
    pedido_id: pedido.id,
    mesero_id: user.id,
    comensal_numero: 1,
  })

  if (subErr) {
    console.error('[abrirPedidoLlevar] error creando el comensal inicial:', {
      pedidoId: pedido.id,
      error: subErr.message,
    })
    return { error: 'Error al crear el comensal.' }
  }

  redirect(`/pos/${pedido.id}`)
}

// ─── Venta rápida (mostrador) ──────────────────────────────────────────────────
// Sin mesa y sin hoja de datos de cliente — crea el pedido de inmediato y salta
// directo al menú, a diferencia de "para llevar" que sí pasa por SheetParaLlevar.
export async function abrirPedidoMostrador(): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) {
    return { error: 'No hay turno activo. Ve a Más → Turno para abrir uno.' }
  }

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      turno_id: turno.id,
      mesa_id: null,
      mesero_id: user.id,
      tipo: 'mostrador',
    })
    .select('id')
    .single()

  if (error || !pedido) {
    return { error: 'Error al crear el pedido.' }
  }

  const { error: subErr } = await supabase.from('subpedidos').insert({
    pedido_id: pedido.id,
    mesero_id: user.id,
    comensal_numero: 1,
  })

  if (subErr) {
    console.error('[abrirPedidoMostrador] error creando el comensal inicial:', {
      pedidoId: pedido.id,
      error: subErr.message,
    })
    return { error: 'Error al crear el comensal.' }
  }

  redirect(`/pos/${pedido.id}`)
}

// ─── Mesa extra (mesa nueva rápida, sin catálogo) ─────────────────────────────
// Igual que compartirMesa() (pos/[pedidoId]/actions.ts), crea una mesa
// `temporal=true` que se borra sola al cobrarse el pedido (liberarMesasSatelite
// / anularPedido ya la manejan correctamente, sin cambios). A diferencia de
// compartirMesa(), no parte de una mesa existente: no tiene area_id ni
// "mesa origen" cuyo nombre heredar, así que usa su propia base ("Extra") con
// el mismo esquema de sufijo. Sin pos_x/pos_y (quedan NULL) para que entre
// directo a la cuadrícula de auto-acomodo que ya usa LienzoMesasEditor para
// mesas sin posición — lista para arrastrarse en /mas/mapa-mesas.
export async function crearMesaExtra(
  capacidad: number,
  areaId: number | null,
): Promise<{ mesaId: number } | Err> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  if (!Number.isFinite(capacidad) || capacidad < 1) {
    return { error: 'Capacidad inválida.' }
  }

  const baseLabel = 'Extra'
  const { data: temporales } = await supabase
    .from('mesas')
    .select('nombre')
    .eq('temporal', true)
    .like('nombre', `${baseLabel}%`)

  const usedSuffixes = new Set(
    (temporales ?? []).map((m) => (m.nombre ?? '').slice(baseLabel.length + 1)),
  )

  let suffix = '1'
  for (let n = 1; n <= 999; n++) {
    if (!usedSuffixes.has(String(n))) {
      suffix = String(n)
      break
    }
  }

  const nombre = `${baseLabel} ${suffix}`

  // `numero`: la UNIQUE de (area_id, numero) excluye mesas temporales (ver
  // 20260224000005_mesas_unique_excluye_temporales.sql), así que un valor
  // fijo no choca con nada — igual que compartirMesa() reutiliza el numero
  // de la mesa origen sin problema entre varias mesas temporales.
  const { data: nuevaMesa, error: mesaErr } = await supabase
    .from('mesas')
    .insert({
      numero: 0,
      nombre,
      area_id: areaId,
      capacidad: Math.round(capacidad),
      activa: true,
      temporal: true,
      estado: 'libre',
    })
    .select('id')
    .single()

  if (mesaErr || !nuevaMesa) return { error: 'Error al crear la mesa.' }

  revalidatePath('/mesas')
  revalidatePath('/mas/mapa-mesas')
  return { mesaId: nuevaMesa.id }
}
