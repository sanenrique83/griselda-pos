'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type ActionResult = { error: string } | undefined
type Err = { error: string }

export async function abrirPedidoMesa(mesaId: number): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar turno activo
  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) {
    return { error: 'No hay turno activo. Ve a Más → Turno para abrir uno.' }
  }

  // Si ya hay pedido abierto en esa mesa (como mesa principal), ir directo a él
  const { data: pedidoExistente } = await supabase
    .from('pedidos')
    .select('id')
    .eq('mesa_id', mesaId)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (pedidoExistente) {
    redirect(`/pos/${pedidoExistente.id}`)
  }

  // O si esta mesa está unida como satélite a otro pedido abierto (unir
  // mesas persistente, ver pedido_mesas) — sin este chequeo se podría crear
  // un pedido duplicado sobre una mesa que ya forma parte de otro pedido.
  const { data: satelites } = await supabase
    .from('pedido_mesas')
    .select('pedido_id, pedidos!inner(estado)')
    .eq('mesa_id', mesaId)
    .eq('pedidos.estado', 'abierto')
    .limit(1)

  if (satelites && satelites.length > 0) {
    redirect(`/pos/${satelites[0].pedido_id}`)
  }

  // Crear pedido
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({
      turno_id: turno.id,
      mesa_id: mesaId,
      mesero_id: user.id,
      tipo: 'mesa',
    })
    .select('id')
    .single()

  if (pedidoError || !pedido) {
    return { error: 'Error al crear el pedido. Intenta de nuevo.' }
  }

  // Primer comensal
  const { error: subError } = await supabase.from('subpedidos').insert({
    pedido_id: pedido.id,
    mesero_id: user.id,
    comensal_numero: 1,
  })

  if (subError) {
    return { error: 'Error al registrar el comensal.' }
  }

  // Cambiar estado de mesa via SECURITY DEFINER
  await supabase.rpc('set_estado_mesa', {
    p_mesa_id: mesaId,
    p_estado: 'ocupada',
  })

  redirect(`/pos/${pedido.id}`)
}

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

  await supabase.from('subpedidos').insert({
    pedido_id: pedido.id,
    mesero_id: user.id,
    comensal_numero: 1,
  })

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

  await supabase.from('subpedidos').insert({
    pedido_id: pedido.id,
    mesero_id: user.id,
    comensal_numero: 1,
  })

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
export async function crearMesaExtra(capacidad: number): Promise<{ mesaId: number } | Err> {
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
