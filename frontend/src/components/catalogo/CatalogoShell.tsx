'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HeaderB } from '@/components/ui/HeaderB'
import { SeccionMesas } from './SeccionMesas'
import { SeccionCategorias } from './SeccionCategorias'
import { SeccionProductos } from './SeccionProductos'
import { SeccionIngredientes } from './SeccionIngredientes'
import type {
  AreaCatalogo,
  CategoriaCatalogo,
  ProductoCatalogo,
  IngredienteCatalogo,
  InsumoCatalogo,
} from '@/app/(app)/mas/catalogo/page'
import type { ModoOrden } from '@/lib/ordenCatalogo'

type Tab = 'mesas' | 'categorias' | 'productos' | 'ingredientes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'mesas', label: 'Mesas' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'productos', label: 'Productos' },
  { id: 'ingredientes', label: 'Ingredientes' },
]

function esTabValida(v: string | null): v is Tab {
  return v === 'mesas' || v === 'categorias' || v === 'productos' || v === 'ingredientes'
}

interface CatalogoShellProps {
  areas: AreaCatalogo[]
  categorias: CategoriaCatalogo[]
  productos: ProductoCatalogo[]
  ingredientes: IngredienteCatalogo[]
  insumos: InsumoCatalogo[]
  modoOrdenProductos: ModoOrden
  modoOrdenModificadores: ModoOrden
}

export function CatalogoShell(props: CatalogoShellProps) {
  return (
    <Suspense fallback={null}>
      <CatalogoShellInner {...props} />
    </Suspense>
  )
}

function CatalogoShellInner({
  areas,
  categorias,
  productos,
  ingredientes,
  insumos,
  modoOrdenProductos,
  modoOrdenModificadores,
}: CatalogoShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabInicial = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(esTabValida(tabInicial) ? tabInicial : 'mesas')
  // Deep-link desde Inventario → Recetas: abre directo el editor de este producto.
  const editarParam = searchParams.get('editar')
  const editarProductoId = editarParam ? Number(editarParam) : null

  return (
    <div className="min-h-full bg-s2">
      <HeaderB
        backLabel="Más"
        onBack={() => router.push('/mas')}
        titulo="Catálogo"
        subtitulo={
          <div className="flex overflow-x-auto scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 px-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors mr-4 last:mr-0 ${
                  tab === t.id
                    ? 'border-[#173F2E] text-[#173F2E]'
                    : 'border-transparent text-text-3'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Contenido del tab */}
      <div className="px-4 py-4">
        {tab === 'mesas' && (
          <SeccionMesas areas={areas} />
        )}
        {tab === 'categorias' && (
          <SeccionCategorias categorias={categorias} />
        )}
        {tab === 'productos' && (
          <SeccionProductos
            productos={productos}
            categorias={categorias}
            ingredientes={ingredientes}
            insumos={insumos}
            editarProductoId={editarProductoId}
            modoOrdenProductos={modoOrdenProductos}
            modoOrdenModificadores={modoOrdenModificadores}
          />
        )}
        {tab === 'ingredientes' && (
          <SeccionIngredientes ingredientes={ingredientes} />
        )}
      </div>
    </div>
  )
}
