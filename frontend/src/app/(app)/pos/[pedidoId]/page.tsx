import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PosShell } from '@/components/pos/PosShell'
import type { MesaOcupada } from '@/components/pos/SheetUnirMesa'
import { columnaOrden } from '@/lib/ordenCatalogo'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

// ─── Tipos exportados (usados por PosShell y sub-componentes) ─────────────────

export type ItemComanda = {
  id: number
  nombre: string
  emoji: string | null
  cantidad: number
  precio_unit: number
  total: number
  estado: 'pendiente' | 'enviado' | 'cancelado'
  notas: string | null
  opciones: { id: number; nombre: string; precio_extra: number }[]
  esBebida: boolean
  // Desglose de combo (fijo + electivo), ya resuelto a texto listo para
  // imprimir — ej. ["2x Refresco", "Bebida: Coca-Cola"]. undefined si el
  // producto no es un combo.
  comboDesglose?: string[]
}

export type SubpedidoPOS = {
  id: number
  comensal_numero: number
  nombre: string | null
  silla_numero: number | null
  total: number
  items: ItemComanda[]
}

// Geometría de la mesa física, para calcular las posiciones de silla en el
// frontend (ver lib/asientos.ts) — null si el pedido no es de tipo 'mesa'
// (para llevar / mostrador no tienen sillas que asignar).
export type MesaSillas = {
  capacidad: number | null
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  asientosHorario: boolean
} | null

// Lista de mesas físicas de la cadena (mesa principal + satélites, en orden),
// solo con la capacidad de cada una — es todo lo que necesita
// calcularPosicionesSillasCadena. null/vacío si el pedido no tiene mesas
// satélite (SheetAsientos sigue usando el diagrama individual sin cambios).
export type MesaCadenaItem = { capacidad: number }

export type ProductoCatalogo = {
  id: number
  nombre: string
  descripcion: string | null
  precio: number
  emoji: string | null
  disponible: boolean
  modo_captura: 'estandar' | 'rapido'
  categoria_id: number
  es_combo: boolean
}

export type CategoriaPOS = {
  id: number
  nombre: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PosPage({
  params,
}: {
  params: Promise<{ pedidoId: string }>
}) {
  const { pedidoId: pedidoIdStr } = await params
  const pedidoId = Number(pedidoIdStr)
  if (isNaN(pedidoId)) redirect('/mesas')

  const supabase = await createClient()

  // ── Pedido + mesa ──────────────────────────────────────────────────────────
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(
      'id, created_at, tipo, num_comensales, mesa_id, mesas(numero, nombre, capacidad, forma, tamano, rotacion, asientos_horario)',
    )
    .eq('id', pedidoId)
    .single()

  if (!pedido) redirect('/mesas')

  // ── Subpedidos → items → opciones ─────────────────────────────────────────
  const { data: rawSubs } = await supabase
    .from('subpedidos')
    .select(`
      id, comensal_numero, nombre, silla_numero,
      pedido_productos(
        id, producto_id, cantidad, precio_unit, estado, notas, nombre_libre, combo_selecciones,
        productos(nombre, emoji, es_combo, categorias(nombre)),
        pedido_producto_opciones(
          precio_extra,
          opciones_modificador(id, nombre)
        )
      )
    `)
    .eq('pedido_id', pedidoId)
    .order('comensal_numero')

  // ── Desglose de combos para el ticket de cocina (F7-04) ────────────────────
  // Los componentes fijos (combo_productos) y las elecciones de slot
  // (combo_selecciones, JSONB) se resuelven aquí a texto listo para
  // imprimir — VistaComanda solo concatena `comboDesglose` a los
  // modificadores del item, no vuelve a resolver nada.
  const comboIds = [
    ...new Set(
      (rawSubs ?? []).flatMap((sub: any) =>
        (sub.pedido_productos ?? [])
          .filter((pp: any) => pp.productos?.es_combo)
          .map((pp: any) => pp.producto_id as number),
      ),
    ),
  ]

  const seleccionProductoIds = new Set<number>()
  const seleccionSlotIds = new Set<number>()
  for (const sub of (rawSubs ?? []) as any[]) {
    for (const pp of sub.pedido_productos ?? []) {
      const selecciones = (pp.combo_selecciones ?? []) as { slot_id: number; producto_id: number }[]
      for (const s of selecciones) {
        seleccionProductoIds.add(s.producto_id)
        seleccionSlotIds.add(s.slot_id)
      }
    }
  }

  const [{ data: comboProductosRaw }, { data: slotsRaw }, { data: productosEleccionRaw }] = await Promise.all([
    comboIds.length > 0
      ? supabase.from('combo_productos').select('combo_id, producto_id, cantidad, productos(nombre)').in('combo_id', comboIds)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : Promise.resolve({ data: [] as any[] }),
    seleccionSlotIds.size > 0
      ? supabase.from('combo_slots').select('id, nombre').in('id', [...seleccionSlotIds])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : Promise.resolve({ data: [] as any[] }),
    seleccionProductoIds.size > 0
      ? supabase.from('productos').select('id, nombre').in('id', [...seleccionProductoIds])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : Promise.resolve({ data: [] as any[] }),
  ])

  const componentesFijosPorCombo = new Map<number, string[]>()
  for (const cp of (comboProductosRaw ?? []) as any[]) {
    const arr = componentesFijosPorCombo.get(cp.combo_id) ?? []
    const nombreComponente = cp.productos?.nombre ?? ''
    arr.push(cp.cantidad > 1 ? `${cp.cantidad}x ${nombreComponente}` : nombreComponente)
    componentesFijosPorCombo.set(cp.combo_id, arr)
  }
  const slotNombrePorId = new Map((slotsRaw ?? []).map((s: any) => [s.id as number, s.nombre as string]))
  const productoNombrePorId = new Map((productosEleccionRaw ?? []).map((p: any) => [p.id as number, p.nombre as string]))

  // ── Otras mesas ocupadas (para unir) ──────────────────────────────────────
  let mesasOcupadas: MesaOcupada[] = []
  if (pedido.tipo === 'mesa' && pedido.mesa_id) {
    const { data: otrosPedidos } = await supabase
      .from('pedidos')
      .select('id, num_comensales, mesa_id, mesas(numero, nombre)')
      .eq('estado', 'abierto')
      .not('mesa_id', 'is', null)
      .neq('id', pedidoId)

    mesasOcupadas = (otrosPedidos ?? []).map((p: any) => ({
      pedidoId: p.id,
      mesaLabel: p.mesas?.nombre ?? `Mesa ${p.mesas?.numero ?? p.mesa_id}`,
      numComensales: p.num_comensales ?? 1,
    }))
  }

  // ── Permiso de cancelación ────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: config }, { data: perfil }] = await Promise.all([
    supabase.from('config_sistema').select('cancelaciones_mesero, cancelar_pedido_mesero, orden_productos').eq('id', 1).single(),
    user ? supabase.from('perfiles').select('rol, nombre').eq('id', user.id).single() : Promise.resolve({ data: null }),
  ])
  const esAdmin = (perfil as any)?.rol === 'admin'
  const puedesCancelar =
    esAdmin || (config as any)?.cancelaciones_mesero === true
  const puedeAnularPedido =
    esAdmin || (config as any)?.cancelar_pedido_mesero === true
  const ordenProductos = columnaOrden((config as any)?.orden_productos)
  const meseroNombre: string =
    (perfil as any)?.nombre ?? user?.email?.split('@')[0] ?? 'Mesero'
  const rol: 'admin' | 'mesero' = (perfil as any)?.rol === 'admin' ? 'admin' : 'mesero'
  const tipoMesa: 'mesa' | 'llevar' | 'mostrador' =
    pedido.tipo === 'mesa' ? 'mesa' : pedido.tipo === 'mostrador' ? 'mostrador' : 'llevar'

  // ── Catálogo: categorías + productos ──────────────────────────────────────
  const [{ data: rawCategorias }, { data: rawProductos }] = await Promise.all([
    supabase
      .from('categorias')
      .select('id, nombre')
      .eq('activa', true)
      .order('orden'),
    supabase
      .from('productos')
      .select(
        'id, nombre, descripcion, precio, emoji, disponible, modo_captura, categoria_id, es_combo',
      )
      .eq('activo', true)
      .order(ordenProductos.column, { ascending: ordenProductos.ascending }),
  ])

  // ── Transformar subpedidos ─────────────────────────────────────────────────
  const subpedidos: SubpedidoPOS[] = (rawSubs ?? []).map((sub: any) => {
    const items: ItemComanda[] = (sub.pedido_productos ?? []).map((pp: any) => {
      const opciones = (pp.pedido_producto_opciones ?? []).map((ppo: any) => ({
        id: ppo.opciones_modificador?.id ?? 0,
        nombre: ppo.opciones_modificador?.nombre ?? '',
        precio_extra: ppo.precio_extra,
      }))
      const extrasTotal = opciones.reduce(
        (s: number, o: any) => s + o.precio_extra,
        0,
      )
      const catNombre: string = (pp.productos as any)?.categorias?.nombre?.toLowerCase() ?? ''

      let comboDesglose: string[] | undefined
      if (pp.productos?.es_combo) {
        const fijos = componentesFijosPorCombo.get(pp.producto_id) ?? []
        const selecciones = ((pp.combo_selecciones ?? []) as { slot_id: number; producto_id: number }[]).map(
          (s) => {
            const slotNombre = slotNombrePorId.get(s.slot_id) ?? 'Opción'
            const prodNombre = productoNombrePorId.get(s.producto_id) ?? ''
            return `${slotNombre}: ${prodNombre}`
          },
        )
        comboDesglose = [...fijos, ...selecciones]
      }

      return {
        id: pp.id,
        nombre: pp.nombre_libre || pp.productos?.nombre || '',
        emoji: pp.nombre_libre ? '✏️' : (pp.productos?.emoji ?? null),
        cantidad: pp.cantidad,
        precio_unit: pp.precio_unit,
        total: (pp.precio_unit + extrasTotal) * pp.cantidad,
        estado: pp.estado,
        notas: pp.notas ?? null,
        opciones,
        esBebida: catNombre.includes('bebida'),
        comboDesglose,
      }
    })

    const subTotal = items
      .filter((i) => i.estado !== 'cancelado')
      .reduce((s, i) => s + i.total, 0)

    return {
      id: sub.id,
      comensal_numero: sub.comensal_numero,
      nombre: sub.nombre ?? null,
      silla_numero: sub.silla_numero ?? null,
      total: subTotal,
      items,
    }
  })

  // ── Geometría de la mesa (para el diagrama de sillas) ──────────────────────
  const mesa = (pedido as any).mesas
  const mesaSillas: MesaSillas =
    pedido.tipo === 'mesa' && mesa
      ? {
          capacidad: mesa.capacidad ?? null,
          forma: mesa.forma ?? 'rectangulo',
          tamano: mesa.tamano ?? 'medio',
          rotacion: mesa.rotacion ?? 0,
          asientosHorario: mesa.asientos_horario ?? true,
        }
      : null

  // ── Mesas satélite unidas (cadena) ──────────────────────────────────────────
  // Solo aplica a pedidos tipo 'mesa'. Si no hay ninguna, mesasCadena queda
  // null y el diagrama de sillas se comporta exactamente igual que antes
  // (mesa individual, sin cambios).
  let mesasCadena: MesaCadenaItem[] | null = null
  if (pedido.tipo === 'mesa' && mesa) {
    const { data: satelites } = await supabase
      .from('pedido_mesas')
      .select('orden, mesas(capacidad)')
      .eq('pedido_id', pedidoId)
      .order('orden')

    if (satelites && satelites.length > 0) {
      mesasCadena = [
        { capacidad: mesa.capacidad ?? 1 },
        ...satelites.map((s: any) => ({ capacidad: s.mesas?.capacidad ?? 1 })),
      ]
    }
  }

  // ── Label del pedido ───────────────────────────────────────────────────────
  const mesaLabel =
    pedido.tipo === 'mesa'
      ? (mesa?.nombre ?? `Mesa ${mesa?.numero ?? pedidoId}`)
      : pedido.tipo === 'mostrador'
        ? 'Mostrador'
        : 'Para llevar'

  const categorias: CategoriaPOS[] = rawCategorias ?? []
  const productos: ProductoCatalogo[] = (rawProductos ?? []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion ?? null,
    precio: p.precio,
    emoji: p.emoji ?? null,
    disponible: p.disponible,
    modo_captura: p.modo_captura ?? 'estandar',
    categoria_id: p.categoria_id,
    es_combo: p.es_combo ?? false,
  }))

  return (
    <PosShell
      pedidoId={pedidoId}
      mesaId={(pedido as any).mesa_id ?? undefined}
      mesaLabel={mesaLabel}
      numComensales={pedido.num_comensales ?? subpedidos.length}
      pedidoCreatedAt={pedido.created_at}
      subpedidos={subpedidos}
      categorias={categorias}
      productos={productos}
      mesasOcupadas={mesasOcupadas}
      puedesCancelar={puedesCancelar}
      puedeAnularPedido={puedeAnularPedido}
      meseroNombre={meseroNombre}
      rol={rol}
      tipoMesa={tipoMesa}
      mesaSillas={mesaSillas}
      mesasCadena={mesasCadena}
    />
  )
}
