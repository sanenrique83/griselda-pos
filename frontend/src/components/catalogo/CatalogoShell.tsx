'use client'

import { useState } from 'react'
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

type Tab = 'mesas' | 'categorias' | 'productos' | 'ingredientes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'mesas', label: 'Mesas' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'productos', label: 'Productos' },
  { id: 'ingredientes', label: 'Ingredientes' },
]

interface CatalogoShellProps {
  areas: AreaCatalogo[]
  categorias: CategoriaCatalogo[]
  productos: ProductoCatalogo[]
  ingredientes: IngredienteCatalogo[]
  insumos: InsumoCatalogo[]
}

export function CatalogoShell({
  areas,
  categorias,
  productos,
  ingredientes,
  insumos,
}: CatalogoShellProps) {
  const [tab, setTab] = useState<Tab>('mesas')

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-0">
        <h1 className="text-[20px] font-bold leading-tight pb-3">Catálogo</h1>
        {/* Tabs — scroll horizontal para 4 tabs en móvil */}
        <div className="flex overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors mr-4 last:mr-0 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-text-3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

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
          />
        )}
        {tab === 'ingredientes' && (
          <SeccionIngredientes ingredientes={ingredientes} />
        )}
      </div>
    </div>
  )
}
