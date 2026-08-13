import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type InsumoLinea = { nombre: string; cantidad: number; unidad: string }

type RecetaDetalle = {
  nombre: string
  rendimiento: string | null
  tiempoPrepMin: number | null
  instrucciones: string | null
  insumos: InsumoLinea[]
}

// ─── Helper ───────────────────────────────────────────────────────────────────
// Solo instrucciones e insumos — nunca costos, para que sirva como referencia
// de cocina accesible a cualquier rol.

async function cargarRecetaDeProducto(
  supabase: SupabaseClient,
  productoId: number,
): Promise<RecetaDetalle | null> {
  const { data: receta } = await supabase
    .from('recetas')
    .select('id, nombre, rendimiento, tiempo_prep_min, instrucciones')
    .eq('producto_id', productoId)
    .maybeSingle()
  if (!receta) return null

  const { data: insumosRows } = await supabase
    .from('receta_insumos')
    .select('cantidad_usada, unidad_medida, insumos(nombre)')
    .eq('receta_id', receta.id)

  return {
    nombre: receta.nombre,
    rendimiento: receta.rendimiento ?? null,
    tiempoPrepMin: receta.tiempo_prep_min ?? null,
    instrucciones: receta.instrucciones ?? null,
    insumos: (insumosRows ?? []).map((r: any) => ({
      nombre: r.insumos?.nombre ?? '',
      cantidad: r.cantidad_usada,
      unidad: r.unidad_medida,
    })),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RecetaDetallePage({
  params,
}: {
  params: Promise<{ productoId: string }>
}) {
  const { productoId: productoIdStr } = await params
  const productoId = Number(productoIdStr)

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: producto } = await supabase
    .from('productos')
    .select('id, nombre, emoji, es_combo')
    .eq('id', productoId)
    .eq('activo', true)
    .maybeSingle()

  if (!producto) notFound()

  if (!producto.es_combo) {
    const receta = await cargarRecetaDeProducto(supabase, producto.id)
    return (
      <DetalleShell producto={producto}>
        {receta ? <RecetaBody receta={receta} /> : <SinDefinir />}
      </DetalleShell>
    )
  }

  // Combo: sus componentes, con la receta de cada uno (sin duplicar insumos).
  const { data: componentesRaw, error: componentesError } = await supabase
    .from('combo_productos')
    .select('cantidad, productos!combo_productos_producto_id_fkey(id, nombre, emoji)')
    .eq('combo_id', producto.id)

  if (componentesError) {
    return (
      <DetalleShell producto={producto}>
        <ErrorAviso mensaje="No se pudieron cargar los componentes de este combo. Intenta recargar la página." />
      </DetalleShell>
    )
  }

  const componentes = await Promise.all(
    (componentesRaw ?? []).map(async (c: any) => {
      const compProductoId: number | undefined = c.productos?.id
      return {
        productoId: compProductoId ?? 0,
        nombre: c.productos?.nombre ?? '',
        emoji: c.productos?.emoji ?? null,
        cantidad: c.cantidad,
        receta: compProductoId ? await cargarRecetaDeProducto(supabase, compProductoId) : null,
      }
    }),
  )

  return (
    <DetalleShell producto={producto}>
      {componentes.length === 0 ? (
        <SinDefinir />
      ) : (
        <div className="space-y-4">
          {componentes.map((c) => (
            <div key={c.productoId} className="rounded-2xl bg-white shadow-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[#E5E5EA] px-4 py-3">
                {c.emoji && <span className="text-[18px] leading-none">{c.emoji}</span>}
                <p className="text-sm font-semibold leading-tight">
                  {c.cantidad}× {c.nombre}
                </p>
              </div>
              <div className="px-4 py-3">
                {c.receta ? (
                  <RecetaBody receta={c.receta} compact />
                ) : (
                  <p className="text-[13px] text-text-4">Sin receta definida para este componente.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DetalleShell>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function DetalleShell({
  producto,
  children,
}: {
  producto: { nombre: string; emoji: string | null; es_combo: boolean }
  children: React.ReactNode
}) {
  return (
    <div className="min-h-full bg-s2">
      <div className="border-b border-[#E5E5EA] bg-white px-4 pt-3 pb-3">
        <Link
          href="/mas/recetario"
          className="mb-2 inline-block text-[15px] font-medium text-[#173F2E] active:opacity-60"
        >
          ‹ Recetario
        </Link>
        <h1 className="text-[18px] font-bold leading-tight">
          {producto.emoji ? `${producto.emoji} ` : ''}
          {producto.nombre}
        </h1>
        {producto.es_combo && <p className="mt-0.5 text-[12px] text-text-3">Combo</p>}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

function SinDefinir() {
  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-8 text-center text-sm text-text-3">
      Aún no se ha definido receta para este producto.
    </div>
  )
}

function ErrorAviso({ mensaje }: { mensaje: string }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-center text-sm text-red-600">
      {mensaje}
    </div>
  )
}

function RecetaBody({ receta, compact = false }: { receta: RecetaDetalle; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      {(receta.rendimiento || receta.tiempoPrepMin != null) && (
        <div className="flex gap-4 text-[12px] text-text-3">
          {receta.rendimiento && (
            <span>
              Rinde: <span className="font-medium text-text-2">{receta.rendimiento}</span>
            </span>
          )}
          {receta.tiempoPrepMin != null && (
            <span>
              Tiempo: <span className="font-medium text-text-2">{receta.tiempoPrepMin} min</span>
            </span>
          )}
        </div>
      )}
      {receta.instrucciones && (
        <div>
          {!compact && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Instrucciones
            </p>
          )}
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-2">
            {receta.instrucciones}
          </p>
        </div>
      )}
      {receta.insumos.length > 0 && (
        <div>
          {!compact && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Insumos
            </p>
          )}
          <ul className="space-y-1">
            {receta.insumos.map((i, idx) => (
              <li key={idx} className="flex items-center justify-between text-[13px]">
                <span className="text-text-2">{i.nombre}</span>
                <span className="font-mono text-text-3">
                  {i.cantidad} {i.unidad}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!receta.instrucciones && receta.insumos.length === 0 && (
        <p className="text-[13px] text-text-4">Receta sin instrucciones ni insumos registrados.</p>
      )}
    </div>
  )
}
