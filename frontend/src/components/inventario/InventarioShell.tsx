'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SeccionInsumos } from './SeccionInsumos'
import { SeccionProveedores } from './SeccionProveedores'
import { SeccionCompras } from './SeccionCompras'
import { SeccionRecetas } from './SeccionRecetas'
import { SeccionInsumosDerivados } from './SeccionInsumosDerivados'
import type {
  InsumoInventario,
  ProveedorInventario,
  HistorialPrecioItem,
  CategoriaConRecetas,
} from '@/app/(app)/mas/inventario/page'

type Tab = 'insumos' | 'proveedores' | 'compras' | 'recetas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'insumos', label: 'Insumos' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'compras', label: 'Compras' },
  { id: 'recetas', label: 'Recetas' },
]

function esTabValida(v: string | null): v is Tab {
  return v === 'insumos' || v === 'proveedores' || v === 'compras' || v === 'recetas'
}

interface InventarioShellProps {
  insumos: InsumoInventario[]
  proveedores: ProveedorInventario[]
  historial: HistorialPrecioItem[]
  categoriasConRecetas: CategoriaConRecetas[]
}

export function InventarioShell(props: InventarioShellProps) {
  return (
    <Suspense fallback={null}>
      <InventarioShellInner {...props} />
    </Suspense>
  )
}

function InventarioShellInner({
  insumos,
  proveedores,
  historial,
  categoriasConRecetas,
}: InventarioShellProps) {
  const searchParams = useSearchParams()
  const tabInicial = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(esTabValida(tabInicial) ? tabInicial : 'insumos')

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-0">
        <h1 className="text-[20px] font-bold leading-tight pb-3">Inventario</h1>
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
        {tab === 'insumos' && <SeccionInsumos insumos={insumos} />}
        {tab === 'proveedores' && <SeccionProveedores proveedores={proveedores} />}
        {tab === 'compras' && <SeccionCompras historial={historial} proveedores={proveedores} />}
        {tab === 'recetas' && (
          <div className="space-y-4">
            <SeccionRecetas categorias={categoriasConRecetas} />
            <SeccionInsumosDerivados insumos={insumos} />
          </div>
        )}
      </div>
    </div>
  )
}
