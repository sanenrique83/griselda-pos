'use server'

import { createClient } from '@/lib/supabase/server'
import { imprimirTicket } from '@/lib/print'

type Err = { error: string }

// ─── Tipos para modificadores ──────────────────────────────────────────────────

export type OpcionMod = {
  id: number
  nombre: string
  precio_extra: number
  activa: boolean
}

export type GrupoMod = {
  id: number
  nombre: string
  requerido: boolean
  minimo: number
  maximo: number
  orden: number
  padre_opcion_id: number | null
  mostrar_en_rapido: boolean
  opciones: OpcionMod[]
}

export type GuisadoMod = {
  id: number
  nombre: string
  precio_extra: number
  disponible: boolean
}

export type GrupoRapido = {
  id: number
  nombre: string
  opciones: GuisadoMod[]
}

// ─── Cargar modificadores (modo estándar) ─────────────────────────────────────
export async function cargarModificadores(
  productoId: number,
): Promise<{ grupos: GrupoMod[] } | Err> {
  console.log('[cargarModificadores] start → productoId:', productoId, typeof productoId)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('grupos_modificadores')
    .select(
      'id, nombre, requerido, minimo, maximo, orden, padre_opcion_id, mostrar_en_rapido, opciones_modificador!grupo_id(id, nombre, precio_extra, activa, ingredientes!ingrediente_id(disponible))',
    )
    .eq('producto_id', productoId)
    .eq('activo', true)
    .order('orden')

  console.log('[cargarModificadores] raw data:', JSON.stringify(data))

  if (error) {
    console.error('[cargarModificadores] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      productoId,
    })
    return { error: `Error al cargar modificadores: ${error.message}` }
  }

  const grupos: GrupoMod[] = (data ?? []).map((gr: any) => ({
    id: gr.id,
    nombre: gr.nombre,
    requerido: gr.requerido,
    minimo: gr.minimo,
    maximo: gr.maximo,
    orden: gr.orden,
    padre_opcion_id: gr.padre_opcion_id ?? null,
    mostrar_en_rapido: gr.mostrar_en_rapido ?? false,
    opciones: (gr.opciones_modificador ?? [])
      .filter((o: any) => o.activa && (o.ingredientes == null || o.ingredientes.disponible !== false))
      .map((o: any) => ({
        id: o.id,
        nombre: o.nombre,
        precio_extra: o.precio_extra,
        activa: o.activa,
      })),
  }))

  console.log(`[cargarModificadores] productoId=${productoId} → ${grupos.length} grupos`)
  return { grupos }
}

// ─── Cargar guisados (modo rápido) ────────────────────────────────────────────
export async function cargarGuisados(
  productoId: number,
): Promise<{ grupos: GrupoRapido[] } | Err> {
  console.log('[cargarGuisados] start → productoId:', productoId, typeof productoId)
  const supabase = await createClient()

  // Query 1: grupos con mostrar_en_rapido=true para este producto
  const { data: gruposData, error: gruposErr } = await supabase
    .from('grupos_modificadores')
    .select('id, nombre')
    .eq('producto_id', productoId)
    .is('mostrar_en_rapido', true)
    .eq('activo', true)
    .order('orden')

  if (gruposErr) {
    console.error('[cargarGuisados] error grupos:', gruposErr.message)
    return { error: `Error al cargar grupos: ${gruposErr.message}` }
  }

  console.log('[cargarGuisados] grupos raw:', JSON.stringify(gruposData))

  if (!gruposData || gruposData.length === 0) {
    return { grupos: [] }
  }

  const grupoIds = gruposData.map((g: any) => g.id)

  // Query 2: opciones activas de esos grupos (excluye eliminadas e ingredientes agotados)
  const { data: opcionesData, error: opcionesErr } = await supabase
    .from('opciones_modificador')
    .select('id, grupo_id, nombre, precio_extra, activa, ingredientes!ingrediente_id(disponible)')
    .in('grupo_id', grupoIds)
    .is('activa', true)
    .order('orden')

  if (opcionesErr) {
    console.error('[cargarGuisados] error opciones:', opcionesErr.message)
    return { error: `Error al cargar opciones: ${opcionesErr.message}` }
  }

  console.log('[cargarGuisados] opciones raw:', JSON.stringify(opcionesData))

  // Combinar en código
  const grupos: GrupoRapido[] = gruposData.map((gr: any) => ({
    id: gr.id,
    nombre: gr.nombre,
    opciones: (opcionesData ?? [])
      .filter((o: any) => o.grupo_id === gr.id && (o.ingredientes == null || o.ingredientes.disponible !== false))
      .map((o: any) => ({
        id: o.id,
        nombre: o.nombre,
        precio_extra: o.precio_extra,
        disponible: true,
      })),
  }))

  console.log(`[cargarGuisados] productoId=${productoId} → ${grupos.length} grupos`)
  console.log('[cargarGuisados] grupos resultado:', JSON.stringify(grupos))
  return { grupos }
}

// ─── Agregar producto (modo estándar) ─────────────────────────────────────────
export async function agregarProducto(data: {
  pedidoId: number
  subpedidoId: number
  productoId: number
  precioUnit: number
  cantidad: number
  notas: string | null
  opciones: { opcionId: number; precioExtra: number }[]
}): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: item, error } = await supabase
    .from('pedido_productos')
    .insert({
      subpedido_id: data.subpedidoId,
      producto_id: data.productoId,
      precio_unit: data.precioUnit,
      cantidad: data.cantidad,
      notas: data.notas,
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (error || !item) return { error: 'Error al agregar el producto.' }

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
}

// ─── Producto libre (item improvisado, no se guarda en catálogo) ──────────────
export async function agregarProductoLibre(data: {
  pedidoId: number
  subpedidoId: number
  nombre: string
  precio: number
}): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: config } = await supabase
    .from('config_sistema')
    .select('producto_libre_id')
    .eq('id', 1)
    .single()

  const productoLibreId = (config as any)?.producto_libre_id
  if (!productoLibreId) {
    return { error: 'Falta configurar el producto libre (corre la migración pendiente).' }
  }

  const { error } = await supabase.from('pedido_productos').insert({
    subpedido_id: data.subpedidoId,
    producto_id: productoLibreId,
    precio_unit: data.precio,
    cantidad: 1,
    nombre_libre: data.nombre.trim(),
    estado: 'pendiente',
  })

  if (error) return { error: 'Error al agregar el ítem.' }
}

// ─── Agregar productos modo rápido (un pedido_producto por guisado) ────────────
export async function agregarProductoRapido(data: {
  pedidoId: number
  subpedidoId: number
  productoId: number
  precioUnit: number
  // una entrada por guisado con cantidad > 0
  guisados: { opcionId: number; cantidad: number; precioExtra: number }[]
}): Promise<Err | undefined> {
  const supabase = await createClient()

  for (const g of data.guisados) {
    const { data: item, error } = await supabase
      .from('pedido_productos')
      .insert({
        subpedido_id: data.subpedidoId,
        producto_id: data.productoId,
        precio_unit: data.precioUnit,
        cantidad: g.cantidad,
        estado: 'pendiente',
      })
      .select('id')
      .single()

    if (error || !item) return { error: 'Error al agregar los tacos.' }

    await supabase.from('pedido_producto_opciones').insert({
      pedido_producto_id: item.id,
      opcion_id: g.opcionId,
      precio_extra: g.precioExtra,
    })
  }
}

// ─── Enviar pendientes a cocina ────────────────────────────────────────────────
// Solo actualiza estado; la integración con el servidor de impresión va después.
export async function enviarACocina(pedidoId: number): Promise<Err | undefined> {
  const supabase = await createClient()

  // Obtener IDs de subpedidos del pedido
  const { data: subs } = await supabase
    .from('subpedidos')
    .select('id')
    .eq('pedido_id', pedidoId)

  if (!subs?.length) return { error: 'No hay comensales en este pedido.' }

  const { error } = await supabase
    .from('pedido_productos')
    .update({ estado: 'enviado' })
    .in(
      'subpedido_id',
      subs.map((s) => s.id),
    )
    .eq('estado', 'pendiente')

  if (error) return { error: 'Error al enviar a cocina.' }
}

// ─── Unir mesas ───────────────────────────────────────────────────────────────
export async function unirMesas(
  pedidoOrigenId: number,
  pedidoDestinoId: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  // Obtener mesa origen para liberarla después
  const { data: pedidoOrigen } = await supabase
    .from('pedidos')
    .select('mesa_id')
    .eq('id', pedidoOrigenId)
    .single()

  // Máximo comensal_numero del destino
  const { data: maxSub } = await supabase
    .from('subpedidos')
    .select('comensal_numero')
    .eq('pedido_id', pedidoDestinoId)
    .order('comensal_numero', { ascending: false })
    .limit(1)

  const offset = maxSub?.[0]?.comensal_numero ?? 0

  // Obtener subpedidos del origen
  const { data: subsOrigen } = await supabase
    .from('subpedidos')
    .select('id, comensal_numero')
    .eq('pedido_id', pedidoOrigenId)
    .order('comensal_numero')

  if (!subsOrigen?.length) return { error: 'El pedido origen no tiene comensales.' }

  // Mover cada subpedido al destino con nuevo número
  for (const sub of subsOrigen) {
    const { error } = await supabase
      .from('subpedidos')
      .update({
        pedido_id: pedidoDestinoId,
        comensal_numero: offset + sub.comensal_numero,
      })
      .eq('id', sub.id)
    if (error) return { error: 'Error al mover los comensales.' }
  }

  // Actualizar num_comensales del destino
  const nuevoTotal = offset + subsOrigen.length
  await supabase
    .from('pedidos')
    .update({ num_comensales: nuevoTotal })
    .eq('id', pedidoDestinoId)

  // Cerrar pedido origen
  await supabase
    .from('pedidos')
    .update({ estado: 'cerrado', cerrado_en: new Date().toISOString() })
    .eq('id', pedidoOrigenId)

  // Liberar mesa origen
  if (pedidoOrigen?.mesa_id) {
    await supabase
      .from('mesas')
      .update({ estado: 'libre' })
      .eq('id', pedidoOrigen.mesa_id)
  }
}

// ─── Eliminar comensal vacío ───────────────────────────────────────────────────
export async function eliminarComensal(
  pedidoId: number,
  subpedidoId: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  // Verificar que no tenga productos (ni cancelados)
  const { count } = await supabase
    .from('pedido_productos')
    .select('id', { count: 'exact', head: true })
    .eq('subpedido_id', subpedidoId)

  if ((count ?? 0) > 0) {
    return { error: 'No se puede eliminar un comensal con productos.' }
  }

  const { error } = await supabase
    .from('subpedidos')
    .delete()
    .eq('id', subpedidoId)
    .eq('pedido_id', pedidoId)

  if (error) return { error: 'Error al eliminar el comensal.' }

  // Actualizar num_comensales
  const { data: restantes } = await supabase
    .from('subpedidos')
    .select('comensal_numero')
    .eq('pedido_id', pedidoId)
    .order('comensal_numero', { ascending: false })
    .limit(1)

  const nuevoMax = restantes?.[0]?.comensal_numero ?? 1
  await supabase
    .from('pedidos')
    .update({ num_comensales: nuevoMax })
    .eq('id', pedidoId)
}

// ─── Compartir mesa (crear mesa temporal con su propio pedido) ────────────────
export async function compartirMesa(
  pedidoOrigenId: number,
  mesaOrigenId: number,
): Promise<{ nuevoPedidoId: number } | Err> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // Turno activo
  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()
  if (!turno) return { error: 'No hay turno activo.' }

  // Datos de la mesa origen
  const { data: mesaOrigen } = await supabase
    .from('mesas')
    .select('numero, nombre, area_id')
    .eq('id', mesaOrigenId)
    .single()
  if (!mesaOrigen) return { error: 'Mesa no encontrada.' }

  // Calcular label base y siguiente sufijo disponible
  const baseLabel = mesaOrigen.nombre ?? `Mesa ${mesaOrigen.numero}`
  const { data: temporales } = await supabase
    .from('mesas')
    .select('nombre')
    .eq('area_id', mesaOrigen.area_id)
    .is('temporal', true)
    .like('nombre', `${baseLabel}%`)

  console.log('[compartirMesa] baseLabel:', baseLabel, '| temporales encontradas:', JSON.stringify(temporales))

  const usedSuffixes = new Set(
    (temporales ?? []).map((m) => (m.nombre ?? '').slice(baseLabel.length)),
  )

  console.log('[compartirMesa] usedSuffixes:', [...usedSuffixes])

  let suffix = 'A'
  for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!usedSuffixes.has(char)) { suffix = char; break }
  }

  console.log('[compartirMesa] suffix elegido:', suffix)

  const newNombre = `${baseLabel}${suffix}`

  // Crear mesa temporal
  const { data: nuevaMesa, error: mesaErr } = await supabase
    .from('mesas')
    .insert({
      area_id: mesaOrigen.area_id,
      numero: mesaOrigen.numero,
      nombre: newNombre,
      activa: true,
      temporal: true,
      estado: 'ocupada',
    })
    .select('id')
    .single()

  if (mesaErr || !nuevaMesa) return { error: 'Error al crear la mesa temporal.' }

  // Crear pedido para la nueva mesa
  const { data: nuevoPedido, error: pedErr } = await supabase
    .from('pedidos')
    .insert({
      tipo: 'mesa',
      estado: 'abierto',
      mesa_id: nuevaMesa.id,
      mesero_id: user.id,
      turno_id: turno.id,
      num_comensales: 1,
    })
    .select('id')
    .single()

  if (pedErr || !nuevoPedido) {
    // Rollback mesa
    await supabase.from('mesas').delete().eq('id', nuevaMesa.id)
    return { error: 'Error al crear el pedido.' }
  }

  // Crear subpedido inicial (comensal 1)
  await supabase.from('subpedidos').insert({
    pedido_id: nuevoPedido.id,
    mesero_id: user.id,
    comensal_numero: 1,
  })

  return { nuevoPedidoId: nuevoPedido.id }
}

// ─── Eliminar ítem pendiente (aún no enviado a cocina) ────────────────────────
// Eliminación directa, sin motivo ni registro de cancelación, porque nada se
// preparó todavía.
export async function eliminarProductoPendiente(
  pedidoProductoId: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  // Solo borra si sigue 'pendiente' — si ya se envió, debe pasar por
  // cancelarItem() para quedar registrado.
  const { data: pp } = await supabase
    .from('pedido_productos')
    .select('id, estado')
    .eq('id', pedidoProductoId)
    .single()

  if (!pp) return { error: 'Producto no encontrado.' }
  if (pp.estado !== 'pendiente') {
    return { error: 'Este ítem ya se envió a cocina, usa cancelar en su lugar.' }
  }

  await supabase
    .from('pedido_producto_opciones')
    .delete()
    .eq('pedido_producto_id', pedidoProductoId)

  const { error } = await supabase
    .from('pedido_productos')
    .delete()
    .eq('id', pedidoProductoId)
    .eq('estado', 'pendiente')

  if (error) return { error: 'Error al eliminar el ítem.' }
}

// ─── Cancelar ítem enviado ────────────────────────────────────────────────────
export async function cancelarItem(
  pedidoProductoId: number,
  motivo: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // 1. Datos del item
  const { data: pp } = await supabase
    .from('pedido_productos')
    .select('precio_unit, cantidad, subpedido_id, productos(nombre)')
    .eq('id', pedidoProductoId)
    .single()

  if (!pp) return { error: 'Producto no encontrado.' }

  // 2. Extras
  const { data: opciones } = await supabase
    .from('pedido_producto_opciones')
    .select('precio_extra, opciones_modificador(nombre)')
    .eq('pedido_producto_id', pedidoProductoId)

  const extrasTotal = (opciones ?? []).reduce((s: number, o: any) => s + o.precio_extra, 0)
  const montoAfectado = (pp.precio_unit + extrasTotal) * pp.cantidad

  // 3. Navegar subpedido → pedido → turno_id
  const { data: sub } = await supabase
    .from('subpedidos')
    .select('pedido_id')
    .eq('id', pp.subpedido_id)
    .single()

  if (!sub) return { error: 'Subpedido no encontrado.' }

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('turno_id, mesa_id, tipo, mesas(numero, nombre)')
    .eq('id', sub.pedido_id)
    .single()

  if (!pedido) return { error: 'Pedido no encontrado.' }

  // 4. Marcar cancelado
  const { error: updErr } = await supabase
    .from('pedido_productos')
    .update({ estado: 'cancelado' })
    .eq('id', pedidoProductoId)

  if (updErr) return { error: 'Error al cancelar el ítem.' }

  // 5. Registrar cancelación
  await supabase.from('cancelaciones').insert({
    pedido_producto_id: pedidoProductoId,
    usuario_id: user.id,
    motivo,
    monto_afectado: montoAfectado,
  })

  // 6. Movimiento de caja negativo
  await supabase.from('movimientos_caja').insert({
    turno_id: pedido.turno_id,
    tipo: 'cancelacion',
    monto: -montoAfectado,
    notas: motivo,
    usuario_id: user.id,
  })

  // 7. Ticket de cancelación en cocina (fallo silencioso — no bloquea)
  const [{ data: cfg }, { data: perfil }] = await Promise.all([
    supabase.from('config_sistema').select('impresion_activa').eq('id', 1).single(),
    supabase.from('perfiles').select('nombre').eq('id', user.id).single(),
  ])

  const nombreProducto = (pp as any).productos?.nombre ?? 'Producto'
  const modificadores: string[] = (opciones ?? [])
    .map((o: any) => o.opciones_modificador?.nombre as string | undefined)
    .filter((n): n is string => !!n)

  const mesaData = (pedido as any).mesas
  const mesaLabel =
    (pedido as any).tipo === 'mesa'
      ? (mesaData?.nombre ?? `Mesa ${mesaData?.numero ?? sub.pedido_id}`)
      : 'Para llevar'
  const meseroNombre =
    (perfil as any)?.nombre ?? user.email?.split('@')[0] ?? 'Mesero'

  void imprimirTicket(
    {
      tipo: 'cancelacion',
      mesa: mesaLabel,
      mesero: meseroNombre,
      items: [{ nombre: nombreProducto, cantidad: pp.cantidad, modificadores, motivo, canceladoPor: meseroNombre }],
    },
    cfg?.impresion_activa ?? false,
  )

  return {}
}

// ─── Mover producto a otro comensal ────────────────────────────────────────────
export async function moverProducto(
  pedidoProductoId: number,
  subpedidoDestinoId: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: pp } = await supabase
    .from('pedido_productos')
    .select('subpedido_id, estado')
    .eq('id', pedidoProductoId)
    .single()

  if (!pp) return { error: 'Producto no encontrado.' }
  if (pp.estado === 'cancelado') return { error: 'No se puede mover un producto cancelado.' }
  if (pp.subpedido_id === subpedidoDestinoId) return { error: 'El producto ya está en ese comensal.' }

  const { error } = await supabase
    .from('pedido_productos')
    .update({ subpedido_id: subpedidoDestinoId })
    .eq('id', pedidoProductoId)

  if (error) return { error: 'Error al mover el producto.' }
}

// ─── Agregar comensal ──────────────────────────────────────────────────────────
export async function agregarComensal(
  pedidoId: number,
): Promise<{ nuevoId: number } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  // Número siguiente
  const { data: subs } = await supabase
    .from('subpedidos')
    .select('comensal_numero')
    .eq('pedido_id', pedidoId)
    .order('comensal_numero', { ascending: false })
    .limit(1)

  const siguiente = (subs?.[0]?.comensal_numero ?? 0) + 1

  const { data: nuevo, error } = await supabase
    .from('subpedidos')
    .insert({
      pedido_id: pedidoId,
      mesero_id: user.id,
      comensal_numero: siguiente,
    })
    .select('id')
    .single()

  if (error || !nuevo) return { error: 'Error al agregar comensal.' }

  // Actualizar num_comensales en el pedido
  await supabase
    .from('pedidos')
    .update({ num_comensales: siguiente })
    .eq('id', pedidoId)

  return { nuevoId: nuevo.id }
}
