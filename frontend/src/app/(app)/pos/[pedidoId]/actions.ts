'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { imprimirTicket, type ItemCancelacion } from '@/lib/print'
import { anularPedido } from '@/app/(app)/cobro/[pedidoId]/actions'
import { columnaOrden, type ModoOrdenModificadores } from '@/lib/ordenCatalogo'
import { horaActualMX, dentroDeHorario } from '@/lib/horarioDisponibilidad'
import { liberarUnaMesaSatelite } from '@/lib/mesasSatelite'
import { primerNombreValido } from '@/lib/nombreUsuario'

type Err = { error: string }

// ─── Tipos para modificadores ──────────────────────────────────────────────────

export type OpcionMod = {
  id: number
  nombre: string
  precio_extra: number
  activa: boolean
  insumo_id: number | null
  orden: number
  // Disponibilidad automática por horario (F9-04) — NULL en ambos = sin restricción.
  horario_desde: string | null
  horario_hasta: string | null
  // Imagen propia opcional — NULL cae en la foto/emoji del producto padre
  // donde se muestre (ver SheetModificadores.tsx, estilo 'cajas').
  foto_url: string | null
  // Categoría opcional para las chips de Modo captura rápida (ver
  // GuisadoMod/SheetCapturaPida.tsx) — se lee aquí también porque el editor
  // de Catálogo (SeccionProductos.tsx) carga las opciones vía
  // cargarModificadores(), no cargarGuisados().
  etiqueta_captura_rapida: string | null
}

export type GrupoMod = {
  id: number
  nombre: string
  requerido: boolean
  minimo: number
  maximo: number
  orden: number
  // Opciones (de otros grupos del mismo producto) que activan este grupo
  // condicional — se muestra si el cliente eligió CUALQUIERA de ellas.
  // Vacío = grupo siempre visible (no condicional).
  opciones_padre: number[]
  mostrar_en_rapido: boolean
  opciones: OpcionMod[]
  // Formato 'texto_natural' del ticket (ver lib/descripcionNatural.ts).
  conector: string | null
  prefijo_seleccion_unica: string | null
  // Estilo de visualización en el sheet de personalización (POS) — control
  // explícito del admin desde Catálogo, ya no se infiere por conteo de
  // opciones. 'cajas' = grid de 4 columnas que envuelve, 'lista' = filas de
  // ancho completo, 'chips' = píldoras compactas sin ícono de check.
  estilo_visual: 'cajas' | 'lista' | 'chips'
}

export type GuisadoMod = {
  id: number
  nombre: string
  precio_extra: number
  disponible: boolean
  // Imagen propia opcional — NULL cae en la foto/emoji del producto padre
  // (ver SheetCapturaPida.tsx).
  foto_url: string | null
  // Categoría opcional para las chips de Modo captura rápida — NULL = solo
  // en "Todas". Ya no se arman las chips a partir de grupos separados.
  etiqueta_captura_rapida: string | null
}

export type GrupoRapido = {
  id: number
  nombre: string
  opciones: GuisadoMod[]
}

// ─── Orden por popularidad (config_sistema.orden_modificadores = 'popularidad') ─
// Reordena en JS las opciones ya cargadas — la popularidad no es una columna
// real, se calcula al vuelo vía RPC (sin guardar ni cachear nada) contando
// pedido_producto_opciones → pedido_productos → subpedidos → pedidos.created_at
// de los últimos `dias` días. Un solo RPC por llamada, acotado a los ids de
// opciones que ya se van a mostrar (nunca un escaneo global).
async function ordenarPorPopularidad<T extends { id: number }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupos: { opciones: T[] }[],
  dias: number,
): Promise<void> {
  const idsUnicos = [...new Set(grupos.flatMap((g) => g.opciones.map((o) => o.id)))]
  if (idsUnicos.length === 0) return

  const { data: popularidad, error } = await supabase.rpc('popularidad_opciones_modificador', {
    p_opcion_ids: idsUnicos,
    p_dias: dias,
  })

  if (error) {
    console.error('[ordenarPorPopularidad] error RPC:', error.message)
    return // se queda con el orden ya cargado (fallback silencioso)
  }

  const conteoPorOpcion = new Map<number, number>(
    (popularidad ?? []).map((p: any) => [p.opcion_id, Number(p.conteo)]),
  )
  for (const g of grupos) {
    g.opciones.sort((a, b) => (conteoPorOpcion.get(b.id) ?? 0) - (conteoPorOpcion.get(a.id) ?? 0))
  }
}

// ─── Cargar modificadores (modo estándar) ─────────────────────────────────────
// soloDisponiblesAhora=true (default, uso en POS) también excluye opciones
// fuera de su ventana horaria (F9-04). El editor de Catálogo llama con
// false para poder ver/editar opciones aunque esté fuera de su horario.
export async function cargarModificadores(
  productoId: number,
  opts: { soloDisponiblesAhora?: boolean } = {},
): Promise<{ grupos: GrupoMod[] } | Err> {
  const soloDisponiblesAhora = opts.soloDisponiblesAhora ?? true
  const supabase = await createClient()

  const { data: configOrden } = await supabase
    .from('config_sistema')
    .select('orden_modificadores, orden_popularidad_dias')
    .eq('id', 1)
    .single()
  const modoOrden = (configOrden as any)?.orden_modificadores as ModoOrdenModificadores | undefined
  const ordenOpciones = columnaOrden(modoOrden)

  const { data, error } = await supabase
    .from('grupos_modificadores')
    .select(
      'id, nombre, requerido, minimo, maximo, orden, mostrar_en_rapido, conector, prefijo_seleccion_unica, estilo_visual, opciones_modificador!grupo_id(id, nombre, precio_extra, activa, insumo_id, orden, horario_desde, horario_hasta, foto_url, etiqueta_captura_rapida, insumos!insumo_id(disponible)), grupo_modificador_padres!grupo_id(opcion_id)',
    )
    .eq('producto_id', productoId)
    .eq('activo', true)
    .order('orden')
    .order(ordenOpciones.column, { referencedTable: 'opciones_modificador', ascending: ordenOpciones.ascending })

  if (error) {
    return { error: `Error al cargar modificadores: ${error.message}` }
  }

  const horaActual = horaActualMX()

  const grupos: GrupoMod[] = (data ?? []).map((gr: any) => ({
    id: gr.id,
    nombre: gr.nombre,
    requerido: gr.requerido,
    minimo: gr.minimo,
    maximo: gr.maximo,
    orden: gr.orden,
    opciones_padre: (gr.grupo_modificador_padres ?? []).map((p: any) => p.opcion_id),
    mostrar_en_rapido: gr.mostrar_en_rapido ?? false,
    conector: gr.conector ?? null,
    prefijo_seleccion_unica: gr.prefijo_seleccion_unica ?? null,
    estilo_visual:
      gr.estilo_visual === 'lista' || gr.estilo_visual === 'chips' ? gr.estilo_visual : 'cajas',
    opciones: (gr.opciones_modificador ?? [])
      .filter(
        (o: any) =>
          o.activa &&
          (o.insumos == null || o.insumos.disponible !== false) &&
          (!soloDisponiblesAhora || dentroDeHorario(o.horario_desde, o.horario_hasta, horaActual)),
      )
      .map((o: any) => ({
        id: o.id,
        nombre: o.nombre,
        precio_extra: o.precio_extra,
        activa: o.activa,
        insumo_id: o.insumo_id ?? null,
        orden: o.orden ?? 0,
        horario_desde: o.horario_desde ?? null,
        horario_hasta: o.horario_hasta ?? null,
        foto_url: o.foto_url ?? null,
        etiqueta_captura_rapida: o.etiqueta_captura_rapida ?? null,
      })),
  }))

  // Popularidad: nunca en Catálogo (soloDisponiblesAhora=false ahí — ver
  // SeccionProductos.tsx, que se queda con el orden alfabético/personalizado
  // ya calculado arriba por columnaOrden()).
  if (modoOrden === 'popularidad' && soloDisponiblesAhora) {
    await ordenarPorPopularidad(supabase, grupos, (configOrden as any)?.orden_popularidad_dias ?? 30)
  }

  return { grupos }
}

// ─── Cargar guisados (modo rápido) ────────────────────────────────────────────
export async function cargarGuisados(
  productoId: number,
): Promise<{ grupos: GrupoRapido[] } | Err> {
  const supabase = await createClient()

  const { data: configOrden } = await supabase
    .from('config_sistema')
    .select('orden_modificadores, orden_popularidad_dias')
    .eq('id', 1)
    .single()
  const modoOrden = (configOrden as any)?.orden_modificadores as ModoOrdenModificadores | undefined
  const ordenOpciones = columnaOrden(modoOrden)

  // Query 1: grupos con mostrar_en_rapido=true para este producto
  const { data: gruposData, error: gruposErr } = await supabase
    .from('grupos_modificadores')
    .select('id, nombre')
    .eq('producto_id', productoId)
    .is('mostrar_en_rapido', true)
    .eq('activo', true)
    .order('orden')

  if (gruposErr) {
    return { error: `Error al cargar grupos: ${gruposErr.message}` }
  }

  if (!gruposData || gruposData.length === 0) {
    return { grupos: [] }
  }

  const grupoIds = gruposData.map((g: any) => g.id)

  // Query 2: opciones activas de esos grupos (excluye eliminadas, insumos
  // agotados, y fuera de su ventana horaria — F9-04, siempre aplica aquí
  // porque este action es exclusivo de POS, nunca del editor de Catálogo)
  const { data: opcionesData, error: opcionesErr } = await supabase
    .from('opciones_modificador')
    .select('id, grupo_id, nombre, precio_extra, activa, horario_desde, horario_hasta, foto_url, etiqueta_captura_rapida, insumos!insumo_id(disponible)')
    .in('grupo_id', grupoIds)
    .is('activa', true)
    .order(ordenOpciones.column, { ascending: ordenOpciones.ascending })

  if (opcionesErr) {
    return { error: `Error al cargar opciones: ${opcionesErr.message}` }
  }

  const horaActual = horaActualMX()

  // Combinar en código
  const grupos: GrupoRapido[] = gruposData.map((gr: any) => ({
    id: gr.id,
    nombre: gr.nombre,
    opciones: (opcionesData ?? [])
      .filter(
        (o: any) =>
          o.grupo_id === gr.id &&
          (o.insumos == null || o.insumos.disponible !== false) &&
          dentroDeHorario(o.horario_desde, o.horario_hasta, horaActual),
      )
      .map((o: any) => ({
        id: o.id,
        nombre: o.nombre,
        precio_extra: o.precio_extra,
        disponible: true,
        foto_url: o.foto_url ?? null,
        etiqueta_captura_rapida: o.etiqueta_captura_rapida ?? null,
      })),
  }))

  // Este action es exclusivo de POS (nunca lo llama Catálogo) — a diferencia
  // de cargarModificadores() no hace falta condicionar por contexto.
  if (modoOrden === 'popularidad') {
    await ordenarPorPopularidad(supabase, grupos, (configOrden as any)?.orden_popularidad_dias ?? 30)
  }

  return { grupos }
}

// ─── Combos electivos (F7-04) ─────────────────────────────────────────────────

export type ComboSlotOpcion = {
  id: number
  productoId: number
  nombre: string
  precio: number
  emoji: string | null
}

export type ComboSlot = {
  id: number
  nombre: string
  requerido: boolean
  opciones: ComboSlotOpcion[]
}

// Se llama ANTES de decidir qué sheet abrir al tocar un producto es_combo=true
// (ver PosShell.handleAgregarProducto) — si devuelve slots, se abre
// SheetComboSlots con ellos ya cargados (sin volver a pedirlos); si devuelve
// vacío, el producto se agrega con el flujo normal (modificadores/rápido),
// exactamente igual que hoy.
export async function cargarComboSlots(productoId: number): Promise<{ slots: ComboSlot[] } | Err> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('combo_slots')
    .select(
      'id, nombre, requerido, combo_slot_opciones(id, producto_id, productos(nombre, precio, emoji))',
    )
    .eq('combo_id', productoId)
    .order('id')

  if (error) return { error: 'Error al cargar las opciones del combo.' }

  const slots: ComboSlot[] = (data ?? []).map((s: any) => ({
    id: s.id,
    nombre: s.nombre,
    requerido: s.requerido,
    opciones: (s.combo_slot_opciones ?? []).map((o: any) => ({
      id: o.id,
      productoId: o.producto_id,
      nombre: o.productos?.nombre ?? '',
      precio: o.productos?.precio ?? 0,
      emoji: o.productos?.emoji ?? null,
    })),
  }))

  return { slots }
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
  // Combos electivos (F7-04): una entrada por slot con selección — ver
  // SheetComboSlots. undefined/vacío para productos que no son combos
  // electivos (incluye combos fijos sin slots, que siguen igual que antes).
  comboSelecciones?: { slotId: number; productoId: number }[]
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
      combo_selecciones:
        data.comboSelecciones && data.comboSelecciones.length > 0
          ? data.comboSelecciones.map((s) => ({ slot_id: s.slotId, producto_id: s.productoId }))
          : null,
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
// Marca 'enviado' y descuenta inventario en la misma transacción, vía la
// función SQL enviar_pedido_a_cocina() (20260726000006_receta_modo_preparacion_consumo.sql).
export async function enviarACocina(pedidoId: number): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('enviar_pedido_a_cocina', {
    p_pedido_id: pedidoId,
  })

  if (error) {
    // El RPC lanza excepciones con mensaje claro (ej. "No hay comensales
    // en este pedido.") — se propaga tal cual en vez de un genérico.
    return { error: error.message || 'Error al enviar a cocina.' }
  }
}

// ─── Unir mesas ───────────────────────────────────────────────────────────────
// Persistente: la mesa origen no se libera — se queda 'ocupada' como mesa
// satélite del pedido destino, registrada en pedido_mesas, hasta que ese
// pedido se cobre por completo (ver cobrarPedido) o se anule. Si el origen ya
// traía sus propias mesas satélite (unión encadenada, A→B y luego B→C), esas
// también se transfieren a C — nunca deben quedar "huérfanas" apuntando a un
// pedido que ya cerró. El orden relativo de la cadena del origen se preserva
// (se ordenan por su propio `orden` antes de re-numerarlas), y se agregan
// siempre al final de la cadena del destino (MAX(orden) del destino + 1, +2…) —
// nunca se insertan en medio.
//
// `reposicion` (opcional): viene del arrastre imantado en /mas/mapa-mesas —
// identifica la mesa física que se arrastró (`mesaId`, siempre una de las
// absorbidas) y a dónde debe moverse visualmente para quedar pegada a la
// mesa destino. Si esa mesa es normal (no temporal), se guarda su posición
// actual en pedido_mesas.pos_x_original/y/rotacion_original ANTES de
// sobrescribirla — así se puede regresar a su lugar al cobrar el pedido (ver
// liberarMesasSatelite en cobro/[pedidoId]/actions.ts). Las mesas temporales
// no se tocan: se borran por completo al cobrar, no tienen a dónde volver.
// Sin este parámetro (llamada desde SheetUnirMesa, sin mapa de por medio) el
// comportamiento es exactamente el de antes.
export async function unirMesas(
  pedidoOrigenId: number,
  pedidoDestinoId: number,
  reposicion?: { mesaId: number; x: number; y: number; rotacion: number } | null,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const [{ data: pedidoOrigen }, { data: satelitesOrigen }, { data: satelitesDestino }] =
    await Promise.all([
      supabase.from('pedidos').select('mesa_id').eq('id', pedidoOrigenId).single(),
      supabase
        .from('pedido_mesas')
        .select('mesa_id, orden')
        .eq('pedido_id', pedidoOrigenId)
        .order('orden'),
      supabase
        .from('pedido_mesas')
        .select('orden')
        .eq('pedido_id', pedidoDestinoId)
        .order('orden'),
    ])

  const mesasAAbsorber = [
    ...(pedidoOrigen?.mesa_id ? [pedidoOrigen.mesa_id] : []),
    ...(satelitesOrigen ?? []).map((s) => s.mesa_id),
  ]

  // Límite de 5 mesas por cadena: destino (mesa principal + satélites que ya
  // tenía) + todas las que se van a absorber del origen. Se valida ANTES de
  // mutar nada — si se rechaza, el pedido origen debe quedar exactamente como
  // estaba (nada de comensales movidos a medias ni pedido cerrado sin unión).
  const totalActualDestino = 1 + (satelitesDestino?.length ?? 0)
  if (mesasAAbsorber.length > 0 && totalActualDestino + mesasAAbsorber.length > 5) {
    return { error: 'No se pueden unir más de 5 mesas en una misma cadena.' }
  }
  const maxOrdenDestino = satelitesDestino?.length
    ? satelitesDestino[satelitesDestino.length - 1].orden
    : 1

  // Datos de la mesa a reposicionar (si aplica) — se leen ANTES de moverla
  // para poder guardar su posición original.
  let mesaRepo: { temporal: boolean; pos_x: number | null; pos_y: number | null; rotacion: number | null } | null =
    null
  if (reposicion && mesasAAbsorber.includes(reposicion.mesaId)) {
    const { data } = await supabase
      .from('mesas')
      .select('temporal, pos_x, pos_y, rotacion')
      .eq('id', reposicion.mesaId)
      .single()
    mesaRepo = data ?? null
  }

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

  // Transferir la propiedad de sus mesas (principal + satélites previos) al
  // destino como mesas satélite — quedan 'ocupada', nunca se liberan aquí.
  if (mesasAAbsorber.length > 0) {
    await supabase.from('pedido_mesas').delete().eq('pedido_id', pedidoOrigenId)

    const guardaOriginal = !!(reposicion && mesaRepo && !mesaRepo.temporal)

    const { error: pmError } = await supabase.from('pedido_mesas').upsert(
      mesasAAbsorber.map((mesaId, idx) => ({
        pedido_id: pedidoDestinoId,
        mesa_id: mesaId,
        orden: maxOrdenDestino + 1 + idx,
        ...(guardaOriginal && mesaId === reposicion!.mesaId
          ? {
              pos_x_original: mesaRepo!.pos_x,
              pos_y_original: mesaRepo!.pos_y,
              rotacion_original: mesaRepo!.rotacion,
            }
          : {}),
      })),
      { onConflict: 'pedido_id,mesa_id' },
    )
    if (pmError) return { error: 'Error al unir las mesas.' }

    await supabase.from('mesas').update({ estado: 'ocupada' }).in('id', mesasAAbsorber)

    // Reacomodo visual: solo para mesas normales, ver nota de `reposicion` arriba.
    if (guardaOriginal) {
      await supabase
        .from('mesas')
        .update({ pos_x: reposicion!.x, pos_y: reposicion!.y, rotacion: reposicion!.rotacion })
        .eq('id', reposicion!.mesaId)
    }
  }
}

// ─── Unir mesa LIBRE a una cadena ya ocupada ───────────────────────────────────
// A diferencia de unirMesas() (que fusiona dos pedidos ya existentes,
// moviendo comensales de uno a otro), aquí la mesa que se une no tiene
// pedido propio — es una mesa libre que se arrastra junto a una mesa/cadena
// ya ocupada en /mas/mapa-mesas. No hay comensales que mover ni picker de
// silla: simplemente amplía la capacidad de la cadena destino con una fila
// más en pedido_mesas, siempre al final (mismo criterio de `orden` y mismo
// límite de 5 mesas que unirMesas()).
export async function unirMesaLibreAOcupada(
  mesaLibreId: number,
  pedidoDestinoId: number,
  reposicion: { x: number; y: number; rotacion: number } | null,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: mesaLibre } = await supabase
    .from('mesas')
    .select('estado, temporal, pos_x, pos_y, rotacion')
    .eq('id', mesaLibreId)
    .single()
  if (!mesaLibre) return { error: 'Mesa no encontrada.' }
  // Protección contra condición de carrera: si alguien más ya la ocupó justo
  // antes de que se soltara el arrastre, no se une a ciegas.
  if (mesaLibre.estado === 'ocupada') return { error: 'Esa mesa ya está ocupada.' }

  const { data: satelitesDestino } = await supabase
    .from('pedido_mesas')
    .select('orden')
    .eq('pedido_id', pedidoDestinoId)
    .order('orden')

  const totalActualDestino = 1 + (satelitesDestino?.length ?? 0)
  if (totalActualDestino + 1 > 5) {
    return { error: 'No se pueden unir más de 5 mesas en una misma cadena.' }
  }
  const maxOrdenDestino = satelitesDestino?.length
    ? satelitesDestino[satelitesDestino.length - 1].orden
    : 1

  const guardaOriginal = !mesaLibre.temporal && !!reposicion

  const { error: pmError } = await supabase.from('pedido_mesas').insert({
    pedido_id: pedidoDestinoId,
    mesa_id: mesaLibreId,
    orden: maxOrdenDestino + 1,
    ...(guardaOriginal
      ? {
          pos_x_original: mesaLibre.pos_x,
          pos_y_original: mesaLibre.pos_y,
          rotacion_original: mesaLibre.rotacion,
        }
      : {}),
  })
  if (pmError) return { error: 'Error al unir la mesa.' }

  await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaLibreId)

  if (guardaOriginal) {
    await supabase
      .from('mesas')
      .update({ pos_x: reposicion!.x, pos_y: reposicion!.y, rotacion: reposicion!.rotacion })
      .eq('id', mesaLibreId)
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

// ─── Anular pedido completo (desde la comanda) ─────────────────────────────────
// A diferencia de anularPedido() (cobro/actions.ts — solo disponible ahí cuando
// el total ya quedó en $0 tras cancelar cada ítem a mano), esta acción cancela
// TODOS los ítems del pedido de una sola vez con un motivo compartido:
//   - 'enviado'   → se revierte inventario vía cancelar_item_enviado() (mismo
//                   RPC que usa cancelarItem) y queda registrado en
//                   `cancelaciones` con el motivo, porque de verdad se preparó.
//   - 'pendiente' → se marca 'cancelado' directo, nada que revertir.
// Al final reutiliza anularPedido() para cerrar el pedido y liberar mesas.
export async function anularPedidoCompleto(
  pedidoId: number,
  mesaId: number | null,
  motivo: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  const [{ data: perfil }, { data: config }] = await Promise.all([
    supabase.from('perfiles').select('nombre, rol').eq('id', user.id).single(),
    supabase.from('config_sistema').select('cancelar_pedido_mesero, impresion_activa').eq('id', 1).single(),
  ])

  const esAdmin = (perfil as any)?.rol === 'admin'
  if (!esAdmin && !(config as any)?.cancelar_pedido_mesero) {
    return { error: 'No tienes permiso para anular pedidos.' }
  }

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('tipo, mesas(numero, nombre)')
    .eq('id', pedidoId)
    .single()
  if (!pedido) return { error: 'Pedido no encontrado.' }

  const { data: subs } = await supabase
    .from('subpedidos')
    .select(
      'estado, pedido_productos(id, estado, precio_unit, cantidad, nombre_libre, productos(nombre), pedido_producto_opciones(precio_extra, opciones_modificador(nombre)))',
    )
    .eq('pedido_id', pedidoId)

  if ((subs ?? []).some((s: any) => s.estado === 'pagado')) {
    return { error: 'No se puede anular: ya hay pagos parciales registrados en este pedido.' }
  }

  const items = (subs ?? []).flatMap((s: any) => s.pedido_productos ?? [])
  const enviados = items.filter((i: any) => i.estado === 'enviado')
  const pendientes = items.filter((i: any) => i.estado === 'pendiente')

  // 1. Pendientes: nada que revertir, se cancelan directo.
  if (pendientes.length > 0) {
    const { error } = await supabase
      .from('pedido_productos')
      .update({ estado: 'cancelado' })
      .in('id', pendientes.map((i: any) => i.id))
    if (error) return { error: 'Error al cancelar los ítems pendientes.' }
  }

  // 2. Enviados: revertir inventario uno por uno y registrar la cancelación.
  const meseroNombre = primerNombreValido((perfil as any)?.nombre, user.email?.split('@')[0])
  const itemsTicket: ItemCancelacion[] = []

  for (const it of enviados) {
    const { error } = await supabase.rpc('cancelar_item_enviado', {
      p_pedido_producto_id: it.id,
    })
    if (error) return { error: error.message || 'Error al cancelar un ítem enviado.' }

    const extrasTotal = (it.pedido_producto_opciones ?? []).reduce(
      (s: number, o: any) => s + o.precio_extra,
      0,
    )
    const montoAfectado = (it.precio_unit + extrasTotal) * it.cantidad

    await supabase.from('cancelaciones').insert({
      pedido_producto_id: it.id,
      usuario_id: user.id,
      motivo,
      monto_afectado: montoAfectado,
    })

    itemsTicket.push({
      nombre: it.nombre_libre || it.productos?.nombre || 'Producto',
      cantidad: it.cantidad,
      modificadores: (it.pedido_producto_opciones ?? [])
        .map((o: any) => o.opciones_modificador?.nombre as string | undefined)
        .filter((n: string | undefined): n is string => !!n),
      motivo,
      canceladoPor: meseroNombre,
    })
  }

  // 3. Ticket de anulación en cocina (un solo ticket con todos los ítems
  // enviados que se cancelan) — fallo silencioso, no bloquea la anulación.
  if (itemsTicket.length > 0) {
    const mesaData = (pedido as any).mesas
    const mesaLabel =
      pedido.tipo === 'mesa'
        ? (mesaData?.nombre ?? `Mesa ${mesaData?.numero ?? pedidoId}`)
        : 'Para llevar'

    void imprimirTicket(
      { tipo: 'cancelacion', mesa: mesaLabel, mesero: meseroNombre, items: itemsTicket },
      (config as any)?.impresion_activa ?? false,
    )
  }

  // 4. Cerrar el pedido y liberar mesas (mismo camino que "Anular mesa" en cobro).
  const result = await anularPedido(pedidoId, mesaId)
  return result?.error ? { error: result.error } : {}
}

// ─── Mover pedido a otra mesa (sin unir) ───────────────────────────────────────
// F9-01: a diferencia de unirMesas() (fusiona dos pedidos, mueve comensales de
// uno a otro y cierra el origen), esto solo reasigna pedidos.mesa_id — mismo
// pedido, mismos comensales, nueva mesa principal. Si el pedido ya tenía mesas
// satélite (unión previa vía pedido_mesas), esas NO se tocan: siguen
// apuntando a este mismo pedido_id, solo cambia cuál es la mesa principal.
export async function moverPedidoDeMesa(
  pedidoId: number,
  mesaDestinoId: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('mesa_id, estado')
    .eq('id', pedidoId)
    .single()
  if (!pedido) return { error: 'Pedido no encontrado.' }
  if (pedido.estado !== 'abierto') return { error: 'El pedido no está abierto.' }
  if (!pedido.mesa_id) return { error: 'Este pedido no tiene mesa asignada.' }
  if (pedido.mesa_id === mesaDestinoId) return { error: 'El pedido ya está en esa mesa.' }

  // Mismo chequeo que abrirPedidoMesa()/abrirPedidoMesaCombinada(): la mesa
  // destino no debe tener ya un pedido abierto propio...
  const { data: pedidoEnDestino } = await supabase
    .from('pedidos')
    .select('id')
    .eq('mesa_id', mesaDestinoId)
    .eq('estado', 'abierto')
    .maybeSingle()
  if (pedidoEnDestino) return { error: 'La mesa destino ya está ocupada.' }

  // ...ni ser satélite de otro pedido abierto (unida vía pedido_mesas).
  const { data: satelitesDestino } = await supabase
    .from('pedido_mesas')
    .select('pedido_id, pedidos!inner(estado)')
    .eq('mesa_id', mesaDestinoId)
    .eq('pedidos.estado', 'abierto')
    .limit(1)
  if (satelitesDestino && satelitesDestino.length > 0) {
    return { error: 'La mesa destino ya está ocupada (unida a otro pedido).' }
  }

  // Protección contra condición de carrera: el estado guardado en la mesa es
  // la fuente final de verdad además de los dos chequeos de arriba.
  const { data: mesaDestino } = await supabase
    .from('mesas')
    .select('estado')
    .eq('id', mesaDestinoId)
    .single()
  if (!mesaDestino) return { error: 'Mesa destino no encontrada.' }
  if (mesaDestino.estado === 'ocupada') return { error: 'La mesa destino ya está ocupada.' }

  const mesaOrigenId = pedido.mesa_id

  const { error } = await supabase
    .from('pedidos')
    .update({ mesa_id: mesaDestinoId })
    .eq('id', pedidoId)
  if (error) return { error: 'Error al mover el pedido.' }

  await supabase.rpc('set_estado_mesa', { p_mesa_id: mesaOrigenId, p_estado: 'libre' })
  await supabase.rpc('set_estado_mesa', { p_mesa_id: mesaDestinoId, p_estado: 'ocupada' })
}

// ─── Separar una mesa de una cadena unida (F9-01) ─────────────────────────────
// A diferencia de moverPedidoDeMesa (reasigna TODA la mesa principal del
// pedido), esto deshace parcialmente una unión: una sola mesa satélite deja
// de pertenecer a la cadena y vuelve a estar libre, sin tocar el resto del
// pedido ni sus ítems — los productos ya consumidos se quedan en el pedido
// original, esta acción no reparte nada.
export async function separarMesaUnida(
  pedidoId: number,
  mesaSateliteId: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado')
    .eq('id', pedidoId)
    .single()
  if (!pedido) return { error: 'Pedido no encontrado.' }
  if (pedido.estado !== 'abierto') return { error: 'El pedido no está abierto.' }

  const { data: fila } = await supabase
    .from('pedido_mesas')
    .select('orden, pos_x_original, pos_y_original, rotacion_original')
    .eq('pedido_id', pedidoId)
    .eq('mesa_id', mesaSateliteId)
    .maybeSingle()
  if (!fila) return { error: 'Esa mesa no está unida a este pedido.' }

  const { data: mesaInfo } = await supabase
    .from('mesas')
    .select('temporal')
    .eq('id', mesaSateliteId)
    .single()

  // Mesas satélite que quedaban después en el orden — cierran el hueco
  // retrocediendo una posición, para que la cadena siga siendo continua.
  const { data: siguientes } = await supabase
    .from('pedido_mesas')
    .select('mesa_id, orden')
    .eq('pedido_id', pedidoId)
    .gt('orden', fila.orden)
    .order('orden')

  const { error: delError } = await supabase
    .from('pedido_mesas')
    .delete()
    .eq('pedido_id', pedidoId)
    .eq('mesa_id', mesaSateliteId)
  if (delError) return { error: 'Error al separar la mesa.' }

  for (const s of siguientes ?? []) {
    const { error: reordError } = await supabase
      .from('pedido_mesas')
      .update({ orden: s.orden - 1 })
      .eq('pedido_id', pedidoId)
      .eq('mesa_id', s.mesa_id)
    if (reordError) return { error: 'La mesa se separó, pero hubo un error al reordenar la cadena.' }
  }

  const { error: libError } = await liberarUnaMesaSatelite(supabase, mesaSateliteId, mesaInfo?.temporal ?? false, fila)
  if (libError) return { error: 'La mesa se separó, pero hubo un error al liberarla. Revisa su estado manualmente.' }
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
  const { error: subErr } = await supabase.from('subpedidos').insert({
    pedido_id: nuevoPedido.id,
    mesero_id: user.id,
    comensal_numero: 1,
  })

  if (subErr) {
    console.error('[compartirMesa] error creando el comensal inicial:', {
      pedidoId: nuevoPedido.id,
      mesaId: nuevaMesa.id,
      error: subErr.message,
    })
    return { error: 'Error al crear el comensal.' }
  }

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

  // 4. Marcar cancelado y revertir inventario en la misma transacción,
  // vía cancelar_item_enviado() (20260726000006_receta_modo_preparacion_consumo.sql).
  const { error: updErr } = await supabase.rpc('cancelar_item_enviado', {
    p_pedido_producto_id: pedidoProductoId,
  })

  if (updErr) return { error: updErr.message || 'Error al cancelar el ítem.' }

  // 5. Registrar cancelación
  await supabase.from('cancelaciones').insert({
    pedido_producto_id: pedidoProductoId,
    usuario_id: user.id,
    motivo,
    monto_afectado: montoAfectado,
  })

  // 6. Movimiento de caja negativo — el ítem ya quedó cancelado por el RPC
  // de arriba (paso 4), así que un fallo aquí no debe reportarse como
  // "cancelación fallida" (sería engañoso, ya se canceló). Se loguea para
  // que el descuadre de caja se pueda rastrear en vez de perderse en silencio.
  const { error: movErr } = await supabase.from('movimientos_caja').insert({
    turno_id: pedido.turno_id,
    tipo: 'cancelacion',
    monto: -montoAfectado,
    notas: motivo,
    usuario_id: user.id,
  })
  if (movErr) {
    console.error('[cancelarItem] error registrando el movimiento de caja de la cancelación:', {
      pedidoProductoId,
      turnoId: pedido.turno_id,
      montoAfectado,
      error: movErr.message,
    })
  }

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
  const meseroNombre = primerNombreValido((perfil as any)?.nombre, user.email?.split('@')[0])

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
// Divide un producto con cantidad > 1: mueve solo `cantidadAMover` unidades a
// otro comensal, dejando el resto donde estaba. Copia los mismos
// modificadores a la parte que se mueve.
export async function dividirProducto(
  pedidoProductoId: number,
  subpedidoDestinoId: number,
  cantidadAMover: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { data: pp } = await supabase
    .from('pedido_productos')
    .select('subpedido_id, producto_id, cantidad, precio_unit, estado, notas, nombre_libre')
    .eq('id', pedidoProductoId)
    .single()

  if (!pp) return { error: 'Producto no encontrado.' }
  if (pp.estado === 'cancelado') return { error: 'No se puede dividir un producto cancelado.' }
  if (pp.subpedido_id === subpedidoDestinoId) return { error: 'El producto ya está en ese comensal.' }
  if (cantidadAMover < 1 || cantidadAMover >= pp.cantidad) {
    return { error: 'Cantidad a dividir inválida.' }
  }

  const { data: opciones } = await supabase
    .from('pedido_producto_opciones')
    .select('opcion_id, precio_extra')
    .eq('pedido_producto_id', pedidoProductoId)

  // Fila nueva con la cantidad que se mueve
  const { data: nuevaFila, error: errorInsert } = await supabase
    .from('pedido_productos')
    .insert({
      subpedido_id: subpedidoDestinoId,
      producto_id: pp.producto_id,
      precio_unit: pp.precio_unit,
      cantidad: cantidadAMover,
      estado: pp.estado,
      notas: pp.notas,
      nombre_libre: pp.nombre_libre,
    })
    .select('id')
    .single()

  if (errorInsert || !nuevaFila) return { error: 'Error al dividir el producto.' }

  if (opciones && opciones.length > 0) {
    await supabase.from('pedido_producto_opciones').insert(
      opciones.map((o) => ({
        pedido_producto_id: nuevaFila.id,
        opcion_id: o.opcion_id,
        precio_extra: o.precio_extra,
      })),
    )
  }

  // Reducir la cantidad restante en la fila original
  const { error: errorUpdate } = await supabase
    .from('pedido_productos')
    .update({ cantidad: pp.cantidad - cantidadAMover })
    .eq('id', pedidoProductoId)

  if (errorUpdate) return { error: 'Error al actualizar la cantidad original.' }
}

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

// ─── Asignar / reasignar silla física a un comensal ────────────────────────────
// Sin columna UNIQUE en BD (el pedido no lo requiere) — se valida aquí que
// ninguna otra silla del mismo pedido tenga ya ese número, para que dos
// comensales nunca queden marcados en la misma silla por error.
export async function asignarSilla(
  subpedidoId: number,
  sillaNumero: number | null,
): Promise<Err | undefined> {
  const supabase = await createClient()

  if (sillaNumero !== null) {
    const { data: actual } = await supabase
      .from('subpedidos')
      .select('pedido_id')
      .eq('id', subpedidoId)
      .single()
    if (!actual) return { error: 'Comensal no encontrado.' }

    const { data: choque } = await supabase
      .from('subpedidos')
      .select('id')
      .eq('pedido_id', actual.pedido_id)
      .eq('silla_numero', sillaNumero)
      .neq('id', subpedidoId)
      .maybeSingle()
    if (choque) return { error: 'Esa silla ya está asignada a otro comensal.' }
  }

  const { error } = await supabase
    .from('subpedidos')
    .update({ silla_numero: sillaNumero })
    .eq('id', subpedidoId)

  if (error) return { error: 'Error al asignar la silla.' }
}

// ─── Reasignar mesero (admin-only) ─────────────────────────────────────────────
// Solo toca pedidos.mesero_id — es el campo que se usa en toda la app para
// atribuir el pedido a un mesero (mesero_nombre en /mesas, "ventas por
// mesero" en Asistencia, Historial). subpedidos.mesero_id es independiente
// a propósito: se fija una sola vez al agregar cada comensal (quién lo
// atendió en ese momento) y es trazabilidad histórica, no "dueño actual" —
// reasignar el pedido no debe reescribir esa historia.
export async function reasignarMesero(
  pedidoId: number,
  nuevoMeseroId: string,
): Promise<Err | { ok: true }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (perfil?.rol !== 'admin') return { error: 'Solo un admin puede reasignar el mesero.' }

  const { data: nuevoMesero } = await supabase
    .from('perfiles')
    .select('id, activo')
    .eq('id', nuevoMeseroId)
    .single()
  if (!nuevoMesero || !nuevoMesero.activo) return { error: 'Ese usuario no está disponible.' }

  const { error } = await supabase
    .from('pedidos')
    .update({ mesero_id: nuevoMeseroId })
    .eq('id', pedidoId)

  if (error) return { error: 'Error al reasignar el mesero.' }

  revalidatePath(`/pos/${pedidoId}`)
  revalidatePath('/mesas')
  return { ok: true }
}
