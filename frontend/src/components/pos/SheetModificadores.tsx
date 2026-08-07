'use client'

import { useEffect, useState, useTransition } from 'react'
import { X, Check, Minus, Plus } from 'lucide-react'
import { cargarModificadores } from '@/app/(app)/pos/[pedidoId]/actions'
import type { GrupoMod, OpcionMod } from '@/app/(app)/pos/[pedidoId]/actions'
import type { ProductoCatalogo } from '@/app/(app)/pos/[pedidoId]/page'
import { Sheet } from '@/components/ui/Sheet'
import { formatCurrency } from '@/components/ui/tokens'

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

// Umbral "pocas vs. muchas opciones" para elegir tarjetas en fila vs. lista
// de radio buttons en un grupo de selección única — no existe un campo en
// grupos_modificadores que distinga esto explícitamente, así que se infiere
// del conteo de opciones (5 = Tamaño en el mockup usa tarjetas; 6 = el
// grupo de "surtido/pedacito" usa lista). Ajustable si en la práctica el
// corte se siente mal en algún producto real.
const MAX_OPCIONES_TARJETA = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function grupoVisible(
  grupo: GrupoMod,
  seleccion: Map<number, Set<number>>,
): boolean {
  if (grupo.opciones_padre.length === 0) return true
  for (const opciones of seleccion.values()) {
    for (const padreId of grupo.opciones_padre) {
      if (opciones.has(padreId)) return true
    }
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

// ─── Subcomponentes de opción ──────────────────────────────────────────────────

// Tarjeta (fila horizontal con scroll) — selección única con pocas opciones
// (ej. Tamaño) o selección múltiple (ej. adicionales, en grid que envuelve).
function TarjetaOpcion({
  opcion,
  seleccionada,
  multi,
  onClick,
}: {
  opcion: OpcionMod
  seleccionada: boolean
  multi: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-[92px] flex-shrink-0 flex-col items-center gap-2 rounded-xl border-[1.5px] p-3 text-center transition-all active:scale-[.97] ${
        seleccionada ? 'border-[#173F2E] bg-[#173F2E]/5' : 'border-[#D1D1D6] bg-white'
      }`}
    >
      <span className="text-[13px] font-bold leading-tight text-text">{opcion.nombre}</span>
      {opcion.precio_extra > 0 && (
        <span className="font-mono text-[11px] font-semibold text-amber-600">
          +{formatCurrency(opcion.precio_extra)}
        </span>
      )}
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 text-white ${
          multi ? 'rounded-[5px]' : 'rounded-full'
        } ${seleccionada ? 'border-[#173F2E] bg-[#173F2E]' : 'border-border bg-white'}`}
      >
        {seleccionada && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  )
}

// Fila completa — selección única con muchas opciones (radio real: círculo,
// nunca cuadrado, para no sugerir multi-selección donde no la hay).
function FilaRadio({
  opcion,
  seleccionada,
  onClick,
}: {
  opcion: OpcionMod
  seleccionada: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left transition-all active:scale-[.98] ${
        seleccionada ? 'border-[#173F2E] bg-[#173F2E]/5' : 'border-[#D1D1D6] bg-white'
      }`}
    >
      <span
        className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 text-white ${
          seleccionada ? 'border-[#173F2E] bg-[#173F2E]' : 'border-border bg-white'
        }`}
      >
        {seleccionada && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="flex-1 text-sm font-semibold text-text">{opcion.nombre}</span>
      {opcion.precio_extra > 0 && (
        <span className="font-mono text-[13px] font-semibold text-amber-600">
          +{formatCurrency(opcion.precio_extra)}
        </span>
      )}
    </button>
  )
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

  // Resumen del pie — las selecciones de grupos "tarjeta" (pocas opciones,
  // única selección — ej. Tamaño) se muestran en mayúsculas para que
  // resalten como el atributo principal, igual que el mockup ("CHICO ·
  // Surtido con pata"); el resto en su capitalización normal. No hay un
  // campo real que marque "este es el grupo de tamaño", así que se
  // reutiliza el mismo criterio de conteo de opciones que decide el layout.
  const resumenPartes = grupos
    .filter((g) => grupoVisible(g, seleccion))
    .flatMap((g) => {
      const esTarjeta = g.maximo === 1 && g.opciones.length <= MAX_OPCIONES_TARJETA
      return g.opciones
        .filter((o) => seleccion.get(g.id)?.has(o.id))
        .map((o) => ({ texto: o.nombre, destacar: esTarjeta }))
    })

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
                <p className="mt-0.5 text-[13px] text-text-3">Personaliza tu pedido</p>
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
              <p className="mt-1.5 text-right font-mono text-xl font-bold text-green-600">
                {formatCurrency(producto.precio)}
              </p>
            )}
          </div>
        </div>
      }
      footer={
        <>
          {/* Resumen + precio */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] text-text-2">
              {resumenPartes.length > 0
                ? resumenPartes.map((p, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      <span className={p.destacar ? 'font-semibold uppercase' : ''}>{p.texto}</span>
                    </span>
                  ))
                : (producto?.nombre ?? '')}
            </p>
            <span className="flex-shrink-0 font-mono text-xl font-bold text-amber-600">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Cantidad + botón confirmar */}
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-card border-[1.5px] border-border">
              <button
                onClick={() => setCantidad((n) => Math.max(1, n - 1))}
                className="flex h-[38px] w-[38px] items-center justify-center text-text-2 active:bg-s2"
              >
                <Minus size={16} strokeWidth={2.4} />
              </button>
              <div className="flex h-[38px] w-[40px] items-center justify-center border-x-[1.5px] border-border font-mono text-base font-bold">
                {cantidad}
              </div>
              <button
                onClick={() => setCantidad((n) => n + 1)}
                className="flex h-[38px] w-[38px] items-center justify-center text-text-2 active:bg-s2"
              >
                <Plus size={16} strokeWidth={2.4} />
              </button>
            </div>

            <button
              onClick={handleConfirmar}
              disabled={!valido || isPending || cargando}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#173F2E] py-[13px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(23,63,46,.32)] active:scale-[.98] active:bg-[#0F2E21] disabled:opacity-40"
            >
              {isPending ? (
                'Agregando…'
              ) : primerPendiente ? (
                `Elige ${primerPendiente.nombre}`
              ) : (
                <>
                  <Check size={16} strokeWidth={2.8} />
                  Agregar a comanda
                </>
              )}
            </button>
          </div>
        </>
      }
    >
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

      {/* Grupos — condicionales (opciones_padre) siguen ocultos hasta que su
          condición se cumple (grupoVisible), sin ningún tratamiento visual
          especial una vez visibles: se ven exactamente como cualquier otro
          grupo (mismo badge Requerido/Opcional según su propio
          grupo.requerido) — el mockup no distingue condicionales de
          normales, así que se dejó de mostrar el badge "Condicional" que
          había antes. */}
      {grupos.map((grupo) => {
        const visible = grupoVisible(grupo, seleccion)
        if (!visible) return null

        const esMulti = grupo.maximo !== 1
        const selGrupo = seleccion.get(grupo.id) ?? new Set<number>()
        const opcionesActivas = grupo.opciones.filter((o) => o.activa)
        const modoTarjeta = !esMulti && opcionesActivas.length <= MAX_OPCIONES_TARJETA
        const cumplido = grupoCumplido(grupo, seleccion)

        return (
          <div key={grupo.id}>
            {/* Encabezado del grupo — el badge de un grupo requerido es
                dinámico ("✓ Listo"/"Elige N"): es retroalimentación
                funcional real (permite ver de un vistazo si falta completar
                un grupo antes de agregar a la comanda), no decoración —
                restaurado a pedido explícito de Rober tras la primera
                pasada, que lo había dejado estático por error. */}
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-[15px] font-semibold text-text">{grupo.nombre}</span>
              {grupo.requerido ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    cumplido ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {cumplido ? '✓ Listo' : `Elige ${grupo.minimo}`}
                </span>
              ) : (
                <span className="rounded-full bg-s2 px-2 py-0.5 text-[11px] font-semibold text-text-3">
                  Opcional
                </span>
              )}
            </div>

            {/* Opciones: tarjetas en fila (única, pocas) / lista de radio
                (única, muchas) / grid que envuelve (múltiple) */}
            {modoTarjeta ? (
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {opcionesActivas.map((opcion) => (
                  <TarjetaOpcion
                    key={opcion.id}
                    opcion={opcion}
                    seleccionada={selGrupo.has(opcion.id)}
                    multi={false}
                    onClick={() => toggleOpcion(grupo, opcion.id)}
                  />
                ))}
              </div>
            ) : esMulti ? (
              <div className="grid grid-cols-2 gap-2.5">
                {opcionesActivas.map((opcion) => (
                  <TarjetaOpcion
                    key={opcion.id}
                    opcion={opcion}
                    seleccionada={selGrupo.has(opcion.id)}
                    multi
                    onClick={() => toggleOpcion(grupo, opcion.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {opcionesActivas.map((opcion) => (
                  <FilaRadio
                    key={opcion.id}
                    opcion={opcion}
                    seleccionada={selGrupo.has(opcion.id)}
                    onClick={() => toggleOpcion(grupo, opcion.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Nota para cocina — no aparece en el mockup, pero es funcionalidad
          real existente (llega hasta el ticket de cocina); se mantiene. */}
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
            className="w-full rounded-card border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
          />
        </div>
      )}

      {error && (
        <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="h-2" />
    </Sheet>
  )
}
