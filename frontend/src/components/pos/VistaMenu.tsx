'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Search, ChevronRight, Plus, Minus, Settings2, UserPlus2, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/components/ui/tokens'
import type { ProductoCatalogo, CategoriaPOS, SubpedidoPOS } from '@/app/(app)/pos/[pedidoId]/page'

interface VistaMenuProps {
  categorias: CategoriaPOS[]
  productos: ProductoCatalogo[]
  subpedidos: SubpedidoPOS[]
  subpedidoActivoId: number
  onCambiarSubpedido: (id: number) => void
  onAgregarProducto: (producto: ProductoCatalogo) => void
  onAgregarLibre?: () => void
  onAgregarComensal?: () => void
  isPendingAgregarComensal?: boolean
}

export function VistaMenu({
  categorias,
  productos,
  subpedidos,
  subpedidoActivoId,
  onCambiarSubpedido,
  onAgregarProducto,
  onAgregarLibre,
  onAgregarComensal,
  isPendingAgregarComensal = false,
}: VistaMenuProps) {
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const chipsRef = useRef<HTMLDivElement>(null)

  // Recorre en orden los comensales YA CREADOS (comensal_numero), nunca
  // salta a sillas físicas sin comensal. Da la vuelta sola del último al
  // primero — sin acción especial, como pidió el usuario.
  const comensalesOrdenados = [...subpedidos].sort((a, b) => a.comensal_numero - b.comensal_numero)
  const indiceActivo = comensalesOrdenados.findIndex((s) => s.id === subpedidoActivoId)
  const posicionActual = indiceActivo >= 0 ? indiceActivo + 1 : 1
  const totalComensales = comensalesOrdenados.length

  function handleSiguienteComensal() {
    if (comensalesOrdenados.length === 0) return
    const siguienteIndice = indiceActivo >= 0 ? (indiceActivo + 1) % comensalesOrdenados.length : 0
    onCambiarSubpedido(comensalesOrdenados[siguienteIndice].id)
  }

  const categoriaNombrePorId = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  )

  // Búsqueda por nombre — no existía antes de este rediseño (el mockup la
  // daba por hecha); se agregó aquí como filtro puramente client-side sobre
  // los productos ya cargados, sin tocar ninguna query ni server action.
  const productosFiltrados = productos
    .filter((p) => (categoriaActiva ? p.categoria_id === categoriaActiva : true))
    .filter((p) => (busqueda.trim() ? p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) : true))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Chips de categoría — patrón "chip de filtro" (regla #1 CLAUDE.md):
          píldora de solo texto, sin ícono. El chevron al final solo desplaza
          el scroll horizontal ya existente, no filtra nada por sí mismo. */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[#E5E5EA] bg-white py-2.5 pl-3 pr-1">
        <div ref={chipsRef} className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCategoriaActiva(null)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              categoriaActiva === null
                ? 'bg-[#173F2E] text-white'
                : 'bg-s2 text-text-2'
            }`}
          >
            Todos
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                categoriaActiva === cat.id
                  ? 'bg-[#173F2E] text-white'
                  : 'bg-s2 text-text-2'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
        <button
          onClick={() => chipsRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
          aria-label="Ver más categorías"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#E5E5EA] text-text-3 active:opacity-60"
        >
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>

      {/* Búsqueda — sin ícono de escaneo ni botón de filtro adicional: no
          existe función de escaneo real ni un filtro más allá de
          categoría+nombre en esta pantalla, y no queremos prometer algo que
          no funciona (mismo criterio ya aplicado a la manija de arrastre en
          Comanda). */}
      <div className="flex-shrink-0 border-b border-[#E5E5EA] bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-xl bg-s2 px-3 py-2.5">
          <Search size={17} strokeWidth={2.2} className="flex-shrink-0 text-text-3" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text placeholder:text-text-3 focus:outline-none"
          />
        </div>
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
            {busqueda.trim() ? 'Sin resultados para tu búsqueda.' : 'No hay productos en esta categoría.'}
          </p>
        )}

        {productosFiltrados.map((producto) => {
          const agotado = !producto.disponible
          const categoriaNombre = categoriaNombrePorId.get(producto.categoria_id)

          return (
            <div
              key={producto.id}
              onClick={() => !agotado && onAgregarProducto(producto)}
              className={`mx-3 mb-2 flex cursor-pointer items-center gap-3 rounded-xl border border-[#E5E5EA] bg-white p-3.5 shadow-card transition-transform active:scale-[.98] ${
                agotado ? 'opacity-60' : ''
              }`}
            >
              {/* Imagen real si existe (foto_url, Catálogo → bucket "productos"),
                  emoji como respaldo — mismo patrón que SeccionProductos.tsx */}
              {producto.foto_url ? (
                <div className="relative h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-xl bg-s2">
                  <Image fill src={producto.foto_url} alt={producto.nombre} className="object-cover" sizes="52px" />
                </div>
              ) : (
                <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-xl bg-s2 text-2xl">
                  {producto.emoji ?? '🍽️'}
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-text">{producto.nombre}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {categoriaNombre && (
                    <span className="rounded-full bg-s2 px-2 py-0.5 text-[10px] font-semibold text-text-2">
                      {categoriaNombre}
                    </span>
                  )}
                  {producto.es_combo && (
                    <span className="flex items-center gap-0.5 rounded-full bg-s2 px-2 py-0.5 text-[10px] font-semibold text-text-2">
                      <Settings2 size={10} strokeWidth={2.4} />
                      Personalizable
                    </span>
                  )}
                  {agotado && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                      Agotado
                    </span>
                  )}
                </div>
                {!agotado && (
                  <p className="mt-1 font-mono text-[13px] font-bold text-green-600">
                    {formatCurrency(producto.precio)}
                  </p>
                )}
              </div>

              {/* Botón +/− */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (!agotado) onAgregarProducto(producto)
                }}
                disabled={agotado}
                aria-label={agotado ? 'Producto agotado' : `Agregar ${producto.nombre}`}
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-transform active:scale-90 ${
                  agotado
                    ? 'bg-s3 text-text-4'
                    : 'bg-[#173F2E] shadow-[0_2px_8px_rgba(23,63,46,.32)] active:bg-[#0F2E21]'
                }`}
              >
                {agotado ? <Minus size={18} strokeWidth={2.4} /> : <Plus size={18} strokeWidth={2.4} />}
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer fijo: Nuevo comensal / Siguiente comensal — sólido verde
          bosque + contorno verde bosque, tal como el mockup (docs/mockups/
          03-mesa-menu.png); distinto del "+ Nuevo comensal" punteado que
          vive DENTRO de cada tarjeta de comensal en la pestaña Comanda —
          ese no se tocó en este cambio. */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 border-t border-[#E5E5EA] bg-white px-3 py-3">
        <div className="flex gap-2">
          {onAgregarComensal && (
            <button
              onClick={onAgregarComensal}
              disabled={isPendingAgregarComensal}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#173F2E] py-[15px] text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(23,63,46,.32)] active:scale-[.98] active:bg-[#0F2E21] disabled:opacity-40"
            >
              <UserPlus2 size={17} strokeWidth={2.4} />
              {isPendingAgregarComensal ? 'Agregando…' : 'Nuevo comensal'}
            </button>
          )}
          <button
            onClick={handleSiguienteComensal}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#173F2E] bg-white py-[15px] text-[15px] font-bold text-[#173F2E] active:scale-[.98] active:bg-s2"
          >
            <ArrowRight size={17} strokeWidth={2.4} />
            Siguiente ({posicionActual} de {totalComensales})
          </button>
        </div>
      </div>
    </div>
  )
}
