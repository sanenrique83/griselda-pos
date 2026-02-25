'use client'

import { useEffect, useState, useTransition } from 'react'
import { cargarGuisados } from '@/app/(app)/pos/[pedidoId]/actions'
import type { ProductoCatalogo } from '@/app/(app)/pos/[pedidoId]/page'

type GuisadoConCantidad = {
  id: number
  nombre: string
  precio_extra: number
  disponible: boolean
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

  // Cargar guisados via Server Action cuando se abre el sheet
  useEffect(() => {
    if (!producto) return
    setGrupos([])
    setError(null)
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

  const todasOpciones = grupos.flatMap((gr) => gr.opciones)
  const totalTacos = todasOpciones.reduce((s, g) => s + g.cantidad, 0)
  const resumen = todasOpciones
    .filter((g) => g.cantidad > 0)
    .map((g) => `${g.nombre} ×${g.cantidad}`)
    .join(' · ')
  const totalPrecio = producto
    ? todasOpciones.reduce(
        (s, g) => s + g.cantidad * (producto.precio + g.precio_extra),
        0,
      )
    : 0

  function handleConfirmar() {
    if (!producto || totalTacos === 0) return
    setError(null)

    const guisadosAgregar = todasOpciones.filter((g) => g.cantidad > 0)
    startTransition(async () => {
      const result = await onConfirmarRapido({
        productoId: producto.id,
        precioUnit: producto.precio,
        guisados: guisadosAgregar.map((g) => ({
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
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[88vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />

        {/* Header */}
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold leading-tight">
                {producto?.nombre}
              </h2>
              <p className="mt-0.5 text-[13px] text-text-3">
                Modo captura rápida
              </p>
            </div>
            {producto && (
              <span className="flex-shrink-0 font-mono text-[17px] font-bold text-green-600">
                ${producto.precio.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mx-4 mt-3 flex-shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-text-2">
          <strong className="text-blue-700">Modo rápido:</strong> ajusta la
          cantidad con [+/−]. El sistema crea una entrada por guisado.
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">

          {/* Skeleton */}
          {cargando && (
            <div className="space-y-2 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-[#E5E5EA] p-3.5"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-s3" />
                    <div className="h-3 w-16 animate-pulse rounded bg-s2" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-[34px] w-[34px] animate-pulse rounded-full bg-s2" />
                    <div className="h-4 w-9 animate-pulse rounded bg-s2" />
                    <div className="h-[34px] w-[34px] animate-pulse rounded-full bg-s2" />
                  </div>
                </div>
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

          {/* Grupos con sus opciones */}
          {grupos.map((grupo, grupoIdx) => (
            <div key={grupo.id} className={grupoIdx > 0 ? 'pt-2' : ''}>
              {/* Título del grupo (solo si hay más de uno) */}
              {grupos.length > 1 && (
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  {grupo.nombre}
                </p>
              )}

              {/* Filas de opciones */}
              {grupo.opciones.map((g) => (
                <div
                  key={g.id}
                  className={`mb-2 flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                    !g.disponible
                      ? 'pointer-events-none border-[#E5E5EA] bg-white opacity-40'
                      : g.cantidad > 0
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-[#E5E5EA] bg-white'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{g.nombre}</p>
                    <p className="font-mono text-xs text-text-3">
                      ${((producto?.precio ?? 0) + g.precio_extra).toFixed(2)} c/u
                    </p>
                    {!g.disponible && (
                      <span className="mt-0.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Agotado
                      </span>
                    )}
                  </div>

                  {/* Contador [− N +] */}
                  <div className="flex items-center">
                    <button
                      onClick={() => ajustar(g.id, -1)}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-border text-lg text-text-2 active:scale-90 active:bg-s2"
                    >
                      −
                    </button>
                    <span
                      className={`w-9 text-center font-mono text-base font-bold transition-colors ${
                        g.cantidad > 0 ? 'text-blue-600' : 'text-text-4'
                      }`}
                    >
                      {g.cantidad}
                    </span>
                    <button
                      onClick={() => ajustar(g.id, 1)}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-border text-lg text-text-2 active:scale-90 active:bg-s2"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Pie fijo */}
        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5">
          {totalTacos > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-s2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-text-2">
                  {totalTacos} taco{totalTacos !== 1 ? 's' : ''} · {resumen}
                </p>
                <p className="mt-0.5 text-[11px] text-text-3">
                  {todasOpciones.filter((g) => g.cantidad > 0).length} entrada
                  {todasOpciones.filter((g) => g.cantidad > 0).length !== 1
                    ? 's'
                    : ''}{' '}
                  en comanda
                </p>
              </div>
              <span className="ml-3 flex-shrink-0 font-mono text-[22px] font-bold text-amber-600">
                ${totalPrecio.toFixed(2)}
              </span>
            </div>
          )}

          {error && (
            <p className="mb-2 rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirmar}
            disabled={totalTacos === 0 || isPending}
            className="w-full rounded-xl bg-blue-600 py-[18px] text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
          >
            {isPending
              ? 'Agregando…'
              : totalTacos > 0
                ? `✓ Agregar ${totalTacos} taco${totalTacos !== 1 ? 's' : ''} a comanda`
                : 'Selecciona al menos un taco'}
          </button>
        </div>
      </div>
    </>
  )
}
