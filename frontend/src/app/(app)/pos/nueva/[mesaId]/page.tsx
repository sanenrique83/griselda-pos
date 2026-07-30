import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PosShell } from '@/components/pos/PosShell'
import type { ProductoCatalogo, CategoriaPOS } from '@/app/(app)/pos/[pedidoId]/page'
import { columnaOrden } from '@/lib/ordenCatalogo'

export default async function NuevaPosPage({
  params,
}: {
  params: Promise<{ mesaId: string }>
}) {
  const { mesaId: mesaIdStr } = await params
  const mesaId = Number(mesaIdStr)
  if (isNaN(mesaId)) redirect('/mesas')

  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Turno activo ──────────────────────────────────────────────────────────
  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) redirect('/mesas')

  // ── Mesa ──────────────────────────────────────────────────────────────────
  const { data: mesa } = await supabase
    .from('mesas')
    .select('id, numero, nombre, estado')
    .eq('id', mesaId)
    .single()

  if (!mesa) redirect('/mesas')

  // Si la mesa ya tiene un pedido abierto, redirigir a ese pedido
  const { data: pedidoExistente } = await supabase
    .from('pedidos')
    .select('id')
    .eq('mesa_id', mesaId)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (pedidoExistente) {
    redirect(`/pos/${pedidoExistente.id}`)
  }

  // ── Catálogo ──────────────────────────────────────────────────────────────
  const { data: configOrden } = await supabase
    .from('config_sistema')
    .select('orden_productos')
    .eq('id', 1)
    .single()
  const ordenProductos = columnaOrden((configOrden as any)?.orden_productos)

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
      .order(ordenProductos.column, { ascending: ordenProductos.ascending }),
  ])

  const mesaLabel = mesa.nombre ?? `Mesa ${mesa.numero}`
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
      pedidoId={null}
      mesaId={mesaId}
      turnoId={turno.id}
      mesaLabel={mesaLabel}
      numComensales={1}
      pedidoCreatedAt=""
      subpedidos={[]}
      categorias={categorias}
      productos={productos}
    />
  )
}
