'use client'

import Link from 'next/link'
import type { CategoriaConRecetas, EstadoReceta } from '@/app/(app)/mas/inventario/page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESTADO_INFO: Record<EstadoReceta, { label: string; className: string }> = {
  completa: { label: 'Completa', className: 'bg-emerald-50 text-emerald-600' },
  incompleta: { label: 'Incompleta', className: 'bg-amber-50 text-amber-600' },
  sin_receta: { label: 'Sin receta', className: 'bg-s2 text-text-4' },
}

function EstadoBadge({ estado }: { estado: EstadoReceta }) {
  const info = ESTADO_INFO[estado]
  return (
    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${info.className}`}>
      {info.label}
    </span>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface SeccionRecetasProps {
  categorias: CategoriaConRecetas[]
}

export function SeccionRecetas({ categorias }: SeccionRecetasProps) {
  if (categorias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[48px] mb-3">📋</p>
        <p className="text-[15px] font-semibold text-text-2">Sin productos</p>
        <p className="mt-1 text-sm text-text-3">
          Crea productos en Catálogo para poder definirles receta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-text-3">
        Toca un producto para abrir su editor de receta en Catálogo.{' '}
        <span className="font-semibold text-amber-600">Incompleta</span> significa que algún
        grupo de modificadores requerido no tiene ninguna opción con receta propia.
      </p>

      {categorias.map((cat) => (
        <div key={cat.categoriaId} className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              {cat.categoriaNombre}
            </p>
          </div>
          <div className="divide-y divide-[#F2F2F7]">
            {cat.productos.map((p) => (
              <Link
                key={p.productoId}
                href={`/mas/catalogo?tab=productos&editar=${p.productoId}`}
                className="flex items-center justify-between gap-2 px-4 py-3 active:bg-s2"
              >
                <span className="min-w-0 truncate text-[13px] font-medium text-text-2">
                  {p.nombre}
                  {p.esCombo && (
                    <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">
                      Combo
                    </span>
                  )}
                </span>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <EstadoBadge estado={p.estado} />
                  <span className="text-[16px] text-text-4">›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
