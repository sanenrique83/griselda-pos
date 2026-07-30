'use client'

import { useState } from 'react'
import type { ProductoCatalogo, CategoriaPOS } from '@/app/(app)/pos/[pedidoId]/page'

interface VistaMenuProps {
  categorias: CategoriaPOS[]
  productos: ProductoCatalogo[]
  totalPedido: number
  onVerComanda: () => void
  onAgregarProducto: (producto: ProductoCatalogo) => void
  onAgregarLibre?: () => void
  onAgregarComensal?: () => void
  isPendingAgregarComensal?: boolean
}

export function VistaMenu({
  categorias,
  productos,
  totalPedido,
  onVerComanda,
  onAgregarProducto,
  onAgregarLibre,
  onAgregarComensal,
  isPendingAgregarComensal = false,
}: VistaMenuProps) {
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)

  const productosFiltrados = categoriaActiva
    ? productos.filter((p) => p.categoria_id === categoriaActiva)
    : productos

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tabs de categorías */}
      <div className="flex overflow-x-auto border-b border-[#E5E5EA] bg-white scrollbar-none">
        <button
          onClick={() => setCategoriaActiva(null)}
          className={`flex-shrink-0 border-b-2 px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
            categoriaActiva === null
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-text-3'
          }`}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoriaActiva(cat.id)}
            className={`flex-shrink-0 border-b-2 px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
              categoriaActiva === cat.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-text-3'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Lista de productos */}
      <div className="flex-1 overflow-y-auto pt-2 pb-24">
        {onAgregarLibre && (
          <button
            onClick={onAgregarLibre}
            className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3.5 py-2.5 text-left active:opacity-70"
          >
            <span className="text-lg">✏️</span>
            <span className="text-[13px] font-semibold text-blue-700">
              Producto libre — algo que no está en el menú
            </span>
          </button>
        )}

        {productosFiltrados.length === 0 && (
          <p className="py-12 text-center text-sm text-text-3">
            No hay productos en esta categoría.
          </p>
        )}

        {productosFiltrados.map((producto) => {
          const agotado = !producto.disponible

          return (
            <div
              key={producto.id}
              onClick={() => !agotado && onAgregarProducto(producto)}
              className={`mx-3 mb-2 flex cursor-pointer items-center gap-3 rounded-xl border border-[#E5E5EA] bg-white p-3.5 shadow-card transition-transform active:scale-[.98] ${
                agotado ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              {/* Emoji / imagen */}
              <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-card bg-s2 text-2xl">
                {producto.emoji ?? '🍽️'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{producto.nombre}</p>
                {producto.descripcion && (
                  <p className="truncate text-xs text-text-3">
                    {producto.descripcion}
                  </p>
                )}
                {agotado ? (
                  <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    Agotado
                  </span>
                ) : (
                  <p className="mt-0.5 font-mono text-sm font-medium text-green-600">
                    ${producto.precio.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Botón + */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (!agotado) onAgregarProducto(producto)
                }}
                disabled={agotado}
                className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,.28)] transition-transform active:scale-90 ${
                  agotado
                    ? 'bg-s3 shadow-none text-text-4'
                    : 'bg-blue-600'
                }`}
              >
                {agotado ? '✕' : '+'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer fijo: + Nuevo comensal / Ver comanda */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 border-t border-[#E5E5EA] bg-white px-3 py-3">
        <div className="flex gap-2">
          {onAgregarComensal && (
            <button
              onClick={onAgregarComensal}
              disabled={isPendingAgregarComensal}
              className="flex-1 rounded-xl bg-green-600 py-[18px] text-base font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {isPendingAgregarComensal ? '…' : '+ Nuevo comensal'}
            </button>
          )}
          <button
            onClick={onVerComanda}
            className="flex-1 rounded-xl bg-blue-600 py-[18px] text-base font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,.28)] active:scale-[.98]"
          >
            Ver comanda
            {totalPedido > 0 && ` — $${totalPedido.toFixed(2)}`} →
          </button>
        </div>
      </div>
    </div>
  )
}
