'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HeaderB } from '@/components/ui/HeaderB'
import { SeccionInsumos } from './SeccionInsumos'
import { SeccionProveedores } from './SeccionProveedores'
import { SeccionCompras } from './SeccionCompras'
import { SeccionRecetas } from './SeccionRecetas'
import { SeccionInsumosDerivados } from './SeccionInsumosDerivados'
import { SeccionMermas } from './SeccionMermas'
import type {
  InsumoInventario,
  ProveedorInventario,
  HistorialPrecioItem,
  CategoriaConRecetas,
  TipoInsumo,
  MermaItem,
  MermaFiltros,
} from '@/app/(app)/mas/inventario/page'

type Tab = 'insumos' | 'proveedores' | 'compras' | 'recetas' | 'mermas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'insumos', label: 'Insumos' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'compras', label: 'Compras' },
  { id: 'recetas', label: 'Recetas' },
  { id: 'mermas', label: 'Mermas' },
]

function esTabValida(v: string | null): v is Tab {
  return v === 'insumos' || v === 'proveedores' || v === 'compras' || v === 'recetas' || v === 'mermas'
}

interface InventarioShellProps {
  insumos: InsumoInventario[]
  proveedores: ProveedorInventario[]
  historial: HistorialPrecioItem[]
  categoriasConRecetas: CategoriaConRecetas[]
  tiposInsumo: TipoInsumo[]
  mermas: MermaItem[]
  mermaFiltrosIniciales: MermaFiltros
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
  tiposInsumo,
  mermas,
  mermaFiltrosIniciales,
}: InventarioShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabInicial = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(esTabValida(tabInicial) ? tabInicial : 'insumos')

  return (
    <div className="min-h-full bg-s2">
      <HeaderB
        backLabel="Más"
        onBack={() => router.push('/mas')}
        titulo="Inventario"
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
        {tab === 'insumos' && <SeccionInsumos insumos={insumos} tiposInsumo={tiposInsumo} />}
        {tab === 'proveedores' && <SeccionProveedores proveedores={proveedores} />}
        {tab === 'compras' && <SeccionCompras historial={historial} proveedores={proveedores} />}
        {tab === 'recetas' && (
          <div className="space-y-4">
            <SeccionRecetas categorias={categoriasConRecetas} />
            <SeccionInsumosDerivados insumos={insumos} />
          </div>
        )}
        {tab === 'mermas' && (
          <SeccionMermas insumos={insumos} mermas={mermas} filtrosIniciales={mermaFiltrosIniciales} />
        )}
      </div>
    </div>
  )
}
