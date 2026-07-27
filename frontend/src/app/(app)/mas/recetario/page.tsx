import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ProductoRecetario = {
  id: number
  nombre: string
  emoji: string | null
  categoriaNombre: string
  esCombo: boolean
  tieneReceta: boolean
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Recetario de cocina: accesible para cualquier rol autenticado (sin costos).

export default async function RecetarioPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rawProductos }, { data: rawCategorias }, { data: rawRecetas }, { data: rawCombos }] =
    await Promise.all([
      supabase.from('productos').select('id, nombre, emoji, categoria_id, es_combo').eq('activo', true),
      supabase.from('categorias').select('id, nombre').eq('activa', true),
      supabase.from('recetas').select('producto_id'),
      supabase.from('combo_productos').select('combo_id'),
    ])

  const catMap = new Map((rawCategorias ?? []).map((c: any) => [c.id, c.nombre as string]))
  const recetaSet = new Set((rawRecetas ?? []).map((r: any) => r.producto_id as number))
  const comboSet = new Set((rawCombos ?? []).map((c: any) => c.combo_id as number))

  const productos: ProductoRecetario[] = (rawProductos ?? []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    emoji: p.emoji ?? null,
    categoriaNombre: catMap.get(p.categoria_id) ?? 'Sin categoría',
    esCombo: p.es_combo,
    tieneReceta: p.es_combo ? comboSet.has(p.id) : recetaSet.has(p.id),
  }))

  const porCategoria = new Map<string, ProductoRecetario[]>()
  for (const p of [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    const arr = porCategoria.get(p.categoriaNombre) ?? []
    arr.push(p)
    porCategoria.set(p.categoriaNombre, arr)
  }

  const categoriasOrdenadas = [...porCategoria.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="min-h-full bg-s2">
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <h1 className="text-[20px] font-bold leading-tight">Recetario</h1>
        <p className="mt-0.5 text-[13px] text-text-3">
          Instrucciones e insumos por producto, para consulta en cocina
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {categoriasOrdenadas.map(([cat, prods]) => (
          <div key={cat} className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="border-b border-[#E5E5EA] px-4 pt-3 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{cat}</p>
            </div>
            <div className="divide-y divide-[#F2F2F7]">
              {prods.map((p) => (
                <Link
                  key={p.id}
                  href={`/mas/recetario/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-s2"
                >
                  {p.emoji && <span className="text-[20px] leading-none flex-shrink-0">{p.emoji}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{p.nombre}</p>
                    <p className="mt-0.5 text-[11px] text-text-3">
                      {p.esCombo ? 'Combo' : 'Producto'} ·{' '}
                      {p.tieneReceta
                        ? p.esCombo ? 'Componentes definidos' : 'Receta definida'
                        : 'Sin definir'}
                    </p>
                  </div>
                  <span className="text-[18px] text-text-4 leading-none">›</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {productos.length === 0 && (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-8 text-center text-sm text-text-3">
            No hay productos en el catálogo.
          </div>
        )}

        <div className="h-2" />
      </div>
    </div>
  )
}
