import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PosShell } from '@/components/pos/PosShell'
import type { MesaOcupada } from '@/components/pos/SheetUnirMesa'

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
}

export type SubpedidoPOS = {
  id: number
  comensal_numero: number
  nombre: string | null
  total: number
  items: ItemComanda[]
}

export type ProductoCatalogo = {
  id: number
  nombre: string
  descripcion: string | null
  precio: number
  emoji: string | null
  disponible: boolean
  modo_captura: 'estandar' | 'rapido'
  categoria_id: number
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
    .select('id, created_at, tipo, num_comensales, mesa_id, mesas(numero, nombre)')
    .eq('id', pedidoId)
    .single()

  if (!pedido) redirect('/mesas')

  // ── Subpedidos → items → opciones ─────────────────────────────────────────
  const { data: rawSubs } = await supabase
    .from('subpedidos')
    .select(`
      id, comensal_numero, nombre,
      pedido_productos(
        id, cantidad, precio_unit, estado, notas,
        productos(nombre, emoji),
        pedido_producto_opciones(
          precio_extra,
          opciones_modificador(id, nombre)
        )
      )
    `)
    .eq('pedido_id', pedidoId)
    .order('comensal_numero')

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
        'id, nombre, descripcion, precio, emoji, disponible, modo_captura, categoria_id',
      )
      .eq('activo', true)
      .order('orden'),
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
      return {
        id: pp.id,
        nombre: pp.productos?.nombre ?? '',
        emoji: pp.productos?.emoji ?? null,
        cantidad: pp.cantidad,
        precio_unit: pp.precio_unit,
        total: (pp.precio_unit + extrasTotal) * pp.cantidad,
        estado: pp.estado,
        notas: pp.notas ?? null,
        opciones,
      }
    })

    const subTotal = items
      .filter((i) => i.estado !== 'cancelado')
      .reduce((s, i) => s + i.total, 0)

    return {
      id: sub.id,
      comensal_numero: sub.comensal_numero,
      nombre: sub.nombre ?? null,
      total: subTotal,
      items,
    }
  })

  // ── Label del pedido ───────────────────────────────────────────────────────
  const mesa = (pedido as any).mesas
  const mesaLabel =
    pedido.tipo === 'mesa'
      ? (mesa?.nombre ?? `Mesa ${mesa?.numero ?? pedidoId}`)
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
    />
  )
}
