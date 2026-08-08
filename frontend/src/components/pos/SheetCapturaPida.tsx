'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Search, X, ShoppingCart, Trash2, Check, Minus, Plus } from 'lucide-react'
import { cargarGuisados } from '@/app/(app)/pos/[pedidoId]/actions'
import type { ProductoCatalogo } from '@/app/(app)/pos/[pedidoId]/page'
import { Sheet } from '@/components/ui/Sheet'
import { formatCurrency } from '@/components/ui/tokens'

type GuisadoConCantidad = {
  id: number
  nombre: string
  precio_extra: number
  disponible: boolean
  foto_url: string | null
  cantidad: number
}

type GrupoConCantidad = {
  id: number
  nombre: string
  opciones: GuisadoConCantidad[]
}

export type ConfirmarRapidoPayload = {
  productoId: number
  precioUnit: number
  guisados: { opcionId: number; cantidad: number; precioExtra: number }[]
}

interface SheetCapturaPidaProps {
  producto: ProductoCatalogo | null
  onConfirmarRapido: (payload: ConfirmarRapidoPayload) => Promise<{ error?: string }>
  onClose: () => void
}

export function SheetCapturaPida({
  producto,
  onConfirmarRapido,
  onClose,
}: SheetCapturaPidaProps) {
  const open = producto !== null
  const [grupos, setGrupos] = useState<GrupoConCantidad[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [grupoActivo, setGrupoActivo] = useState<number | null>(null)

  // Cargar guisados via Server Action cuando se abre el sheet
  useEffect(() => {
    if (!producto) return
    setGrupos([])
    setError(null)
    setBusqueda('')
    setGrupoActivo(null)
    setCargando(true)

    cargarGuisados(producto.id).then((result) => {
      if ('error' in result) {
        setError(result.error)
        setCargando(false)
        return
      }
      setGrupos(
        result.grupos.map((gr) => ({
          id: gr.id,
          nombre: gr.nombre,
          opciones: gr.opciones.map((g) => ({ ...g, cantidad: 0 })),
        })),
      )
      setCargando(false)
    })
  }, [producto?.id])

  function ajustar(opcionId: number, delta: number) {
    setGrupos((prev) =>
      prev.map((gr) => ({
        ...gr,
        opciones: gr.opciones.map((g) =>
          g.id === opcionId
            ? { ...g, cantidad: Math.max(0, Math.min(20, g.cantidad + delta)) }
            : g,
        ),
      })),
    )
  }

  function handleLimpiarSeleccion() {
    setGrupos((prev) => prev.map((gr) => ({ ...gr, opciones: gr.opciones.map((g) => ({ ...g, cantidad: 0 })) })))
  }

  // Plano con grupoId para filtrar por chip de categoría — las categorías
  // SON los grupos con mostrar_en_rapido=true (no hay un concepto de
  // categoría aparte en captura rápida), "Todas" es la unión de todos.
  const todasOpcionesPlano = useMemo(
    () => grupos.flatMap((gr) => gr.opciones.map((o) => ({ ...o, grupoId: gr.id }))),
    [grupos],
  )
  const totalTacos = todasOpcionesPlano.reduce((s, g) => s + g.cantidad, 0)
  const entradas = todasOpcionesPlano.filter((g) => g.cantidad > 0)
  const resumen = entradas.map((g) => `${g.nombre} ×${g.cantidad}`).join(' · ')
  const totalPrecio = producto
    ? todasOpcionesPlano.reduce((s, g) => s + g.cantidad * (producto.precio + g.precio_extra), 0)
    : 0

  // Búsqueda + chip de categoría — filtro client-side simple sobre lo ya
  // cargado, mismo patrón que VistaMenu.tsx (sin query nueva).
  const opcionesVisibles = todasOpcionesPlano
    .filter((o) => (grupoActivo ? o.grupoId === grupoActivo : true))
    .filter((o) => (busqueda.trim() ? o.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) : true))

  function handleConfirmar() {
    if (!producto || totalTacos === 0) return
    setError(null)

    startTransition(async () => {
      const result = await onConfirmarRapido({
        productoId: producto.id,
        precioUnit: producto.precio,
        guisados: entradas.map((g) => ({
          opcionId: g.id,
          cantidad: g.cantidad,
          precioExtra: g.precio_extra,
        })),
      })
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      maxHeightClass="max-h-[92vh]"
      header={
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-[#E5E5EA] px-5 py-4">
          {producto?.foto_url ? (
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-s2">
              <img src={producto.foto_url} alt={producto.nombre} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-s2 text-2xl">
              {producto?.emoji ?? '🍽️'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-bold leading-tight text-text">
                  {producto?.nombre}
                </h2>
                <p className="mt-0.5 text-[13px] text-text-3">Modo captura rápida</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#E5E5EA] text-text-2 active:opacity-60"
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>
            {producto && (
              <div className="mt-1.5 flex items-center justify-end gap-2">
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                  Precio base
                </span>
                <span className="font-mono text-xl font-bold text-green-600">
                  {formatCurrency(producto.precio)}
                </span>
              </div>
            )}
          </div>
        </div>
      }
      footer={
        <>
          {totalTacos > 0 && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#173F2E]/5 px-4 py-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#173F2E] text-white">
                <ShoppingCart size={16} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-text-2">
                  {totalTacos} · {resumen}
                </p>
                <p className="mt-0.5 text-[11px] text-text-3">
                  {entradas.length} entrada{entradas.length !== 1 ? 's' : ''} en comanda
                </p>
              </div>
              <span className="ml-2 flex-shrink-0 font-mono text-xl font-bold text-amber-600">
                {formatCurrency(totalPrecio)}
              </span>
            </div>
          )}

          {error && (
            <p className="mb-2 rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            {totalTacos > 0 && (
              <button
                onClick={handleLimpiarSeleccion}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border-[1.5px] border-border bg-white px-4 py-[13px] text-sm font-semibold text-text-2 active:scale-[.98] active:bg-s2"
              >
                <Trash2 size={16} strokeWidth={2.2} />
                Limpiar
              </button>
            )}
            <button
              onClick={handleConfirmar}
              disabled={totalTacos === 0 || isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#173F2E] py-[13px] text-sm font-bold text-white shadow-[0_4px_14px_rgba(23,63,46,.32)] active:scale-[.98] active:bg-[#0F2E21] disabled:opacity-40"
            >
              {isPending ? (
                'Agregando…'
              ) : totalTacos > 0 ? (
                <>
                  <Check size={16} strokeWidth={2.8} />
                  Agregar {totalTacos} a comanda
                </>
              ) : (
                'Selecciona al menos una presentación'
              )}
            </button>
          </div>
        </>
      }
    >
      {/* Búsqueda — sin botón "Filtros" aparte: los chips de categoría de
          abajo ya cubren el único filtro real que existe aquí, y no hay
          ninguna función de escaneo, mismo criterio ya aplicado en Menú y
          en Comanda (no prometer algo que no funciona). */}
      <div className="flex items-center gap-2 rounded-xl bg-s2 px-3 py-2.5">
        <Search size={17} strokeWidth={2.2} className="flex-shrink-0 text-text-3" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar presentación…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-text placeholder:text-text-3 focus:outline-none"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="flex-shrink-0 text-text-3 active:opacity-60">
            <X size={15} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Banner de instrucción */}
      <div className="flex items-center gap-2 rounded-xl bg-[#173F2E]/5 px-4 py-2.5 text-[13px] text-text-2">
        <span className="text-base">⚡</span>
        Selecciona la presentación. Ajusta cantidad con [+] [−].
      </div>

      {/* Chips de categoría — las categorías SON los grupos mostrar_en_rapido
          de este producto; solo tiene sentido filtrar si hay más de uno. */}
      {grupos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGrupoActivo(null)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              grupoActivo === null ? 'bg-[#173F2E] text-white' : 'bg-s2 text-text-2'
            }`}
          >
            Todas ({todasOpcionesPlano.length})
          </button>
          {grupos.map((gr) => (
            <button
              key={gr.id}
              onClick={() => setGrupoActivo(gr.id)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                grupoActivo === gr.id ? 'bg-[#173F2E] text-white' : 'bg-s2 text-text-2'
              }`}
            >
              {gr.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Skeleton */}
      {cargando && (
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-xl bg-s2" />
          ))}
        </div>
      )}

      {/* Sin guisados configurados */}
      {!cargando && !error && grupos.length === 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Este producto no tiene guisados configurados. Configura un grupo
          de modificadores con "Mostrar en rápido" activado en el Catálogo.
        </div>
      )}

      {!cargando && grupos.length > 0 && opcionesVisibles.length === 0 && (
        <p className="py-10 text-center text-sm text-text-3">Sin resultados para tu búsqueda.</p>
      )}

      {/* Cuadrícula 2 columnas — imagen propia de la opción si existe, si
          no la del producto padre (nunca queda vacía). */}
      <div className="grid grid-cols-2 gap-2.5">
        {opcionesVisibles.map((g) => {
          const fotoUrl = g.foto_url ?? producto?.foto_url ?? null
          const activa = g.cantidad > 0
          return (
            <div
              key={g.id}
              className={`overflow-hidden rounded-xl border-[1.5px] transition-colors ${
                !g.disponible
                  ? 'pointer-events-none border-[#E5E5EA] bg-white opacity-40'
                  : activa
                    ? 'border-[#173F2E] bg-[#173F2E]/5'
                    : 'border-[#E5E5EA] bg-white'
              }`}
            >
              <div className="relative h-[88px] w-full bg-s2">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    {producto?.emoji ?? '🍽️'}
                  </div>
                )}
                {activa && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#173F2E] text-white shadow">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>

              <div className="p-2.5">
                <p className="line-clamp-2 text-[13px] font-bold leading-tight text-text">{g.nombre}</p>
                <p className="mt-1 font-mono text-[12px] text-text-3">
                  {formatCurrency((producto?.precio ?? 0) + g.precio_extra)} c/u
                </p>
                {!g.disponible && (
                  <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    Agotado
                  </span>
                )}

                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => ajustar(g.id, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-border text-text-2 active:scale-90 active:bg-s2"
                  >
                    <Minus size={14} strokeWidth={2.4} />
                  </button>
                  <span className={`w-6 text-center font-mono text-[15px] font-bold ${activa ? 'text-[#173F2E]' : 'text-text-4'}`}>
                    {g.cantidad}
                  </span>
                  <button
                    onClick={() => ajustar(g.id, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-border text-text-2 active:scale-90 active:bg-s2"
                  >
                    <Plus size={14} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="h-2" />
    </Sheet>
  )
}
