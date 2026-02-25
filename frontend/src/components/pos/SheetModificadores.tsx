'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { cargarModificadores } from '@/app/(app)/pos/[pedidoId]/actions'
import type { GrupoMod } from '@/app/(app)/pos/[pedidoId]/actions'
import type { ProductoCatalogo } from '@/app/(app)/pos/[pedidoId]/page'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConfirmarModPayload = {
  productoId: number
  precioUnit: number
  cantidad: number
  notas: string | null
  opciones: { opcionId: number; precioExtra: number }[]
}

interface SheetModificadoresProps {
  producto: ProductoCatalogo | null
  onConfirmar: (payload: ConfirmarModPayload) => Promise<{ error?: string }>
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function grupoVisible(
  grupo: GrupoMod,
  seleccion: Map<number, Set<number>>,
): boolean {
  if (grupo.padre_opcion_id === null) return true
  for (const opciones of seleccion.values()) {
    if (opciones.has(grupo.padre_opcion_id)) return true
  }
  return false
}

function grupoCumplido(
  grupo: GrupoMod,
  seleccion: Map<number, Set<number>>,
): boolean {
  if (!grupo.requerido) return true
  return (seleccion.get(grupo.id)?.size ?? 0) >= grupo.minimo
}

function esValido(
  grupos: GrupoMod[],
  seleccion: Map<number, Set<number>>,
): boolean {
  return grupos.every((g) => {
    if (!grupoVisible(g, seleccion)) return true
    return grupoCumplido(g, seleccion)
  })
}

function precioTotal(
  base: number,
  cantidad: number,
  grupos: GrupoMod[],
  seleccion: Map<number, Set<number>>,
): number {
  let extras = 0
  for (const grupo of grupos) {
    if (!grupoVisible(grupo, seleccion)) continue
    for (const opcion of grupo.opciones) {
      if (seleccion.get(grupo.id)?.has(opcion.id)) extras += opcion.precio_extra
    }
  }
  return (base + extras) * cantidad
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SheetModificadores({
  producto,
  onConfirmar,
  onClose,
}: SheetModificadoresProps) {
  const open = producto !== null
  const [grupos, setGrupos] = useState<GrupoMod[]>([])
  const [cargando, setCargando] = useState(false)
  const [seleccion, setSeleccion] = useState<Map<number, Set<number>>>(
    new Map(),
  )
  const [cantidad, setCantidad] = useState(1)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const renderCount = useRef(0)

  // Debug: confirmar que seleccion cambia y el componente re-renderiza
  useEffect(() => {
    renderCount.current += 1
    console.log(
      `[SheetModificadores] seleccion update #${renderCount.current}`,
      'entries:', seleccion.size,
      Object.fromEntries(
        Array.from(seleccion.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
    )
  }, [seleccion])

  // Cargar modificadores via Server Action cuando se abre el sheet
  useEffect(() => {
    if (!producto) return
    setGrupos([])
    setSeleccion(new Map())
    setCantidad(1)
    setNotas('')
    setError(null)
    setCargando(true)

    cargarModificadores(producto.id).then((result) => {
      if ('error' in result) {
        setError(result.error)
        setCargando(false)
        return
      }
      setGrupos(result.grupos)
      setCargando(false)
    })
  }, [producto?.id])

  function toggleOpcion(grupo: GrupoMod, opcionId: number) {
    console.log('[toggleOpcion] fired → grupo.id:', grupo.id, 'opcionId:', opcionId, 'maximo:', grupo.maximo)
    setSeleccion((prev) => {
      if (grupo.maximo === 1) {
        // Radio — selección única: nuevo Map + nuevo Set
        return new Map(prev).set(grupo.id, new Set([opcionId]))
      }
      // Checkbox — multi-selección hasta maximo
      const actual = new Set(prev.get(grupo.id) ?? [])
      if (actual.has(opcionId)) {
        actual.delete(opcionId)
      } else if (actual.size < grupo.maximo) {
        actual.add(opcionId)
      }
      return new Map(prev).set(grupo.id, actual)
    })
  }

  function handleConfirmar() {
    if (!producto) return
    setError(null)

    const opcionesSeleccionadas: { opcionId: number; precioExtra: number }[] = []
    for (const grupo of grupos) {
      if (!grupoVisible(grupo, seleccion)) continue
      const ids = seleccion.get(grupo.id) ?? new Set()
      for (const opcion of grupo.opciones) {
        if (ids.has(opcion.id)) {
          opcionesSeleccionadas.push({
            opcionId: opcion.id,
            precioExtra: opcion.precio_extra,
          })
        }
      }
    }

    startTransition(async () => {
      const result = await onConfirmar({
        productoId: producto.id,
        precioUnit: producto.precio,
        cantidad,
        notas: notas.trim() || null,
        opciones: opcionesSeleccionadas,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  const valido = esValido(grupos, seleccion)
  const total = producto
    ? precioTotal(producto.precio, cantidad, grupos, seleccion)
    : 0

  const primerPendiente = grupos.find(
    (g) =>
      grupoVisible(g, seleccion) && g.requerido && !grupoCumplido(g, seleccion),
  )

  const resumenOpciones = grupos
    .filter((g) => grupoVisible(g, seleccion))
    .flatMap((g) =>
      g.opciones
        .filter((o) => seleccion.get(g.id)?.has(o.id))
        .map((o) => o.nombre),
    )
    .join(' · ')

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[92vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />

        {/* Header */}
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold leading-tight">
                {producto?.nombre}
              </h2>
              <p className="mt-0.5 text-[13px] text-text-3">
                Selecciona las opciones
              </p>
            </div>
            {producto && (
              <span className="flex-shrink-0 font-mono text-[17px] font-bold text-green-600">
                ${producto.precio.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Skeleton */}
          {cargando && (
            <div className="space-y-5 pt-1">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-28 animate-pulse rounded-md bg-s3" />
                    <div className="h-[18px] w-16 animate-pulse rounded-full bg-s2" />
                  </div>
                  <div className="h-[54px] animate-pulse rounded-xl bg-s2" />
                  <div className="h-[54px] animate-pulse rounded-xl bg-s2" />
                  {i === 0 && (
                    <div className="h-[54px] animate-pulse rounded-xl bg-s2" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sin modificadores */}
          {!cargando && grupos.length === 0 && !error && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-text-2">
              Este producto no tiene modificadores. Puedes agregarlo
              directamente.
            </div>
          )}

          {/* Grupos */}
          {grupos.map((grupo) => {
            const visible = grupoVisible(grupo, seleccion)
            if (!visible) return null

            const esMulti = grupo.maximo !== 1
            const selGrupo = seleccion.get(grupo.id) ?? new Set<number>()
            const esCondicional = grupo.padre_opcion_id !== null
            const cumplido = grupoCumplido(grupo, seleccion)

            return (
              <div key={grupo.id}>
                {/* Encabezado del grupo */}
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-[15px] font-semibold">
                    {grupo.nombre}
                  </span>
                  {esCondicional ? (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600">
                      Condicional
                    </span>
                  ) : grupo.requerido ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                        cumplido
                          ? 'bg-green-50 text-green-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {cumplido ? '✓ Listo' : `Elige ${grupo.minimo}`}
                    </span>
                  ) : (
                    <span className="rounded-full bg-s2 px-2 py-0.5 text-[11px] font-semibold text-text-3">
                      Opcional
                      {grupo.maximo > 1 ? ` — máx. ${grupo.maximo}` : ''}
                    </span>
                  )}
                </div>

                {/* Opciones */}
                <div
                  className={
                    esCondicional
                      ? 'rounded-xl border border-purple-100 bg-purple-50 p-3.5'
                      : ''
                  }
                >
                  {esCondicional && (
                    <p className="mb-2.5 text-[11px] font-semibold text-purple-600">
                      Visible por opción seleccionada anteriormente
                    </p>
                  )}

                  <div className="space-y-2">
                    {grupo.opciones
                      .filter((o) => o.activa)
                      .map((opcion) => {
                        const sel = selGrupo.has(opcion.id)
                        return (
                          <button
                            key={opcion.id}
                            onClick={() => toggleOpcion(grupo, opcion.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left transition-all active:scale-[.98] ${
                              sel
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-[#D1D1D6] bg-white'
                            }`}
                          >
                            {/* Radio / Checkbox */}
                            <div
                              className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center border-2 text-xs font-bold text-white transition-all ${
                                esMulti ? 'rounded-[5px]' : 'rounded-full'
                              } ${
                                sel
                                  ? 'border-blue-600 bg-blue-600'
                                  : 'border-border'
                              }`}
                            >
                              {sel && '✓'}
                            </div>

                            <span className="flex-1 text-sm font-medium">
                              {opcion.nombre}
                            </span>

                            {opcion.precio_extra > 0 && (
                              <span className="font-mono text-[13px] text-amber-600">
                                +${opcion.precio_extra.toFixed(2)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Notas */}
          {!cargando && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Nota para cocina (opcional)
              </label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: sin cebolla, extra limón…"
                className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>
          )}

          {error && (
            <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="h-2" />
        </div>

        {/* Pie fijo */}
        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5">
          {/* Resumen + precio */}
          <div className="mb-3 flex items-center justify-between">
            <p className="max-w-[60%] truncate text-[13px] text-text-2">
              {resumenOpciones || (producto?.nombre ?? '')}
            </p>
            <span className="font-mono text-xl font-bold text-amber-600">
              ${total.toFixed(2)}
            </span>
          </div>

          {/* Cantidad + botón confirmar */}
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-card border-[1.5px] border-border">
              <button
                onClick={() => setCantidad((n) => Math.max(1, n - 1))}
                className="flex h-[38px] w-[38px] items-center justify-center text-lg text-text-2 active:bg-s2"
              >
                −
              </button>
              <div className="flex h-[38px] w-[40px] items-center justify-center border-x-[1.5px] border-border font-mono text-base font-bold">
                {cantidad}
              </div>
              <button
                onClick={() => setCantidad((n) => n + 1)}
                className="flex h-[38px] w-[38px] items-center justify-center text-lg text-text-2 active:bg-s2"
              >
                +
              </button>
            </div>

            <button
              onClick={handleConfirmar}
              disabled={!valido || isPending || cargando}
              className="flex-1 rounded-xl bg-blue-600 py-[11px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {isPending
                ? 'Agregando…'
                : primerPendiente
                  ? `Elige ${primerPendiente.nombre}`
                  : '✓ Agregar a comanda'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
