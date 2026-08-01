'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  cargarReceta,
  guardarReceta,
  cargarComboComponentes,
  guardarComboComponentes,
  cargarComboSlots,
  guardarComboSlots,
  obtenerCostosInsumos,
  obtenerMargenProductos,
} from '@/app/(app)/mas/catalogo/actions'
import type { ModoPreparacionReceta } from '@/app/(app)/mas/catalogo/actions'
import type { ProductoCatalogo, InsumoCatalogo } from '@/app/(app)/mas/catalogo/page'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type LineaInsumo = {
  key: string
  insumoId: number | ''
  cantidad: string
}

type OpcionGrupo = {
  id: number
  nombre: string
  insumo_id: number | null
}

type GrupoModificadorReceta = {
  id: number
  nombre: string
  requerido: boolean
  opciones: OpcionGrupo[]
}

type LineaComponente = {
  key: string
  productoId: number | ''
  cantidad: string
}

type LineaSlot = {
  key: string
  nombre: string
  requerido: boolean
  productoIds: number[]
}

function nuevaLineaInsumo(): LineaInsumo {
  return { key: Math.random().toString(36).slice(2), insumoId: '', cantidad: '' }
}

function nuevaLineaComponente(): LineaComponente {
  return { key: Math.random().toString(36).slice(2), productoId: '', cantidad: '1' }
}

function nuevaLineaSlot(): LineaSlot {
  return { key: Math.random().toString(36).slice(2), nombre: '', requerido: true, productoIds: [] }
}

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface SeccionRecetaProps {
  producto: ProductoCatalogo
  productos: ProductoCatalogo[]
  insumos: InsumoCatalogo[]
  grupos: GrupoModificadorReceta[]
}

export function SeccionReceta({ producto, productos, insumos, grupos }: SeccionRecetaProps) {
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Receta (producto normal)
  const [nombre, setNombre] = useState('')
  const [modoPreparacion, setModoPreparacion] = useState<ModoPreparacionReceta>('por_orden')
  const [rendimiento, setRendimiento] = useState('')
  const [tiempoPrep, setTiempoPrep] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [porcionesDisponibles, setPorcionesDisponibles] = useState('0')
  const [rendimientoEsperado, setRendimientoEsperado] = useState('')
  const [lineasInsumo, setLineasInsumo] = useState<LineaInsumo[]>([nuevaLineaInsumo()])
  const [costosInsumo, setCostosInsumo] = useState<Map<number, number>>(new Map())

  // Combo (componentes)
  const [lineasComponente, setLineasComponente] = useState<LineaComponente[]>([nuevaLineaComponente()])
  const [costosProducto, setCostosProducto] = useState<
    Map<number, { costo: number | null; completo: boolean }>
  >(new Map())

  // Combo (slots electivos)
  const [lineasSlot, setLineasSlot] = useState<LineaSlot[]>([])
  const [isPendingSlots, startTransitionSlots] = useTransition()
  const [errorSlots, setErrorSlots] = useState<string | null>(null)
  const [savedSlots, setSavedSlots] = useState(false)

  const insumoMap = new Map(insumos.map((i) => [i.id, i]))
  const candidatosCombo = productos.filter((p) => !p.es_combo && p.id !== producto.id)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSaved(false)
    setErrorSlots(null)
    setSavedSlots(false)

    if (producto.es_combo) {
      Promise.all([
        cargarComboComponentes(producto.id),
        obtenerMargenProductos(),
        cargarComboSlots(producto.id),
      ]).then(([comboRes, margenRes, slotsRes]) => {
          if ('error' in comboRes) { setError(comboRes.error); setLoading(false); return }
          setLineasComponente(
            comboRes.componentes.length > 0
              ? comboRes.componentes.map((c) => ({
                  key: Math.random().toString(36).slice(2),
                  productoId: c.productoId,
                  cantidad: String(c.cantidad),
                }))
              : [nuevaLineaComponente()],
          )
          if (!('error' in margenRes)) {
            setCostosProducto(
              new Map(margenRes.margenes.map((m) => [m.productoId, { costo: m.costo, completo: m.costoCompleto }])),
            )
          }
          if (!('error' in slotsRes)) {
            setLineasSlot(
              slotsRes.slots.map((s) => ({
                key: Math.random().toString(36).slice(2),
                nombre: s.nombre,
                requerido: s.requerido,
                productoIds: s.opciones.map((o) => o.productoId),
              })),
            )
          }
          setLoading(false)
        },
      )
    } else {
      Promise.all([cargarReceta(producto.id), obtenerCostosInsumos()]).then(([recetaRes, costosRes]) => {
        if ('error' in recetaRes) { setError(recetaRes.error); setLoading(false); return }
        const modo = recetaRes.receta?.modo_preparacion ?? 'por_orden'
        setModoPreparacion(modo)
        if (recetaRes.receta) {
          setNombre(recetaRes.receta.nombre)
          setRendimiento(recetaRes.receta.rendimiento ?? '')
          setTiempoPrep(recetaRes.receta.tiempo_prep_min?.toString() ?? '')
          setInstrucciones(recetaRes.receta.instrucciones ?? '')
          setPorcionesDisponibles(String(recetaRes.receta.porciones_disponibles ?? 0))
          setRendimientoEsperado(recetaRes.receta.rendimiento_esperado?.toString() ?? '')
          if (modo === 'reventa') {
            // Exactamente un insumo, cantidad fija en 1 — el artículo mismo.
            const primera = recetaRes.receta.insumos[0]
            setLineasInsumo([
              primera
                ? { key: Math.random().toString(36).slice(2), insumoId: primera.insumoId, cantidad: '1' }
                : nuevaLineaInsumo(),
            ])
          } else {
            setLineasInsumo(
              recetaRes.receta.insumos.length > 0
                ? recetaRes.receta.insumos.map((i) => ({
                    key: Math.random().toString(36).slice(2),
                    insumoId: i.insumoId,
                    cantidad: String(i.cantidad_usada),
                  }))
                : [nuevaLineaInsumo()],
            )
          }
        } else {
          setNombre(producto.nombre)
          setRendimiento('')
          setTiempoPrep('')
          setInstrucciones('')
          setPorcionesDisponibles('0')
          setRendimientoEsperado('')
          setLineasInsumo([nuevaLineaInsumo()])
        }
        if (!('error' in costosRes)) {
          setCostosInsumo(new Map(costosRes.costos.map((c) => [c.insumoId, c.costoUnitario])))
        }
        setLoading(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id, producto.es_combo])

  // ── Agrupación automática por opción de modificador ─────────────────────────
  // Una línea de insumo "aplica a" una opción si su insumoId coincide con el
  // insumo_id de esa opción (Paso A) — no hay nada que elegir a mano: si el
  // insumo de la línea coincide con el de una opción del producto, la línea
  // se agrupa bajo esa opción; si no coincide con ninguna, es "de siempre".

  type EtiquetaOpcion = { grupoNombre: string; opcionNombre: string }
  const opcionesPorInsumo = new Map<number, EtiquetaOpcion[]>()
  for (const g of grupos) {
    for (const o of g.opciones) {
      if (o.insumo_id == null) continue
      const lista = opcionesPorInsumo.get(o.insumo_id) ?? []
      lista.push({ grupoNombre: g.nombre, opcionNombre: o.nombre })
      opcionesPorInsumo.set(o.insumo_id, lista)
    }
  }

  function etiquetaDeLinea(l: LineaInsumo): { esVariable: boolean; label: string } {
    if (l.insumoId === '') return { esVariable: false, label: 'Siempre' }
    const opciones = opcionesPorInsumo.get(l.insumoId)
    if (!opciones || opciones.length === 0) return { esVariable: false, label: 'Siempre' }
    return { esVariable: true, label: opciones.map((o) => o.opcionNombre).join(' / ') }
  }

  // ── Cálculos de costo en vivo ──────────────────────────────────────────────
  // Las líneas variables (una por cada opción, ej. Adobada/Bistec/Chicharrón)
  // son alternativas mutuamente excluyentes, no costos que se sumen — el
  // total en vivo solo suma los insumos "de siempre", igual que
  // margen_productos() en el servidor.

  function costoLineaInsumo(l: LineaInsumo): number | null {
    if (l.insumoId === '') return 0
    const costo = costosInsumo.get(l.insumoId)
    if (costo === undefined) return null
    const cantidad = parseFloat(l.cantidad)
    return isNaN(cantidad) ? 0 : costo * cantidad
  }

  const hayLineaVariable = lineasInsumo.some((l) => etiquetaDeLinea(l).esVariable)

  const costoTotalReceta = (() => {
    let total = 0
    for (const l of lineasInsumo) {
      if (l.insumoId === '' || etiquetaDeLinea(l).esVariable) continue
      const c = costoLineaInsumo(l)
      if (c === null) return null
      total += c
    }
    return total
  })()

  function subtotalLineaComponente(l: LineaComponente): number | null {
    if (l.productoId === '') return 0
    const info = costosProducto.get(l.productoId)
    if (!info || info.costo === null || !info.completo) return null
    const cantidad = parseInt(l.cantidad)
    return isNaN(cantidad) ? 0 : info.costo * cantidad
  }

  const costoTotalCombo = (() => {
    let total = 0
    for (const l of lineasComponente) {
      if (l.productoId === '') continue
      const s = subtotalLineaComponente(l)
      if (s === null) return null
      total += s
    }
    return total
  })()

  // Aviso no bloqueante: grupos requeridos sin ninguna opción con receta
  // propia (ninguna línea de insumo tiene un insumoId que coincida con el
  // insumo_id de alguna de sus opciones).
  const insumosConLinea = new Set(
    lineasInsumo.filter((l) => l.insumoId !== '').map((l) => l.insumoId as number),
  )
  const gruposSinRecetaPropia = grupos.filter(
    (g) =>
      g.requerido &&
      !g.opciones.some((o) => o.insumo_id != null && insumosConLinea.has(o.insumo_id)),
  )

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleModoChange(nuevo: ModoPreparacionReceta) {
    if (nuevo === modoPreparacion) return
    if (nuevo === 'reventa') {
      // Colapsar a un solo insumo, cantidad fija en 1 — el artículo mismo.
      setLineasInsumo((prev) => {
        const primera = prev.find((l) => l.insumoId !== '') ?? prev[0] ?? nuevaLineaInsumo()
        return [{ ...primera, cantidad: '1' }]
      })
    }
    setError(null)
    setSaved(false)
    setModoPreparacion(nuevo)
  }

  function handleGuardarReceta() {
    if (!nombre.trim()) { setError('Ingresa un nombre para la receta.'); return }
    setError(null)
    setSaved(false)

    const items = lineasInsumo
      .filter((l) => l.insumoId !== '')
      .map((l) => {
        const insumo = insumoMap.get(l.insumoId as number)!
        return {
          insumoId: l.insumoId as number,
          cantidad_usada: modoPreparacion === 'reventa' ? 1 : parseFloat(l.cantidad) || 0,
          unidad_medida: insumo.unidad_medida,
        }
      })

    startTransition(async () => {
      const result = await guardarReceta(producto.id, {
        nombre: nombre.trim(),
        modo_preparacion: modoPreparacion,
        rendimiento: modoPreparacion === 'reventa' ? null : rendimiento.trim() || null,
        tiempo_prep_min: modoPreparacion === 'reventa' ? null : (tiempoPrep.trim() ? parseInt(tiempoPrep) || null : null),
        instrucciones: modoPreparacion === 'reventa' ? null : instrucciones.trim() || null,
        ...(modoPreparacion === 'por_lote'
          ? {
              porciones_disponibles: parseFloat(porcionesDisponibles) || 0,
              rendimiento_esperado: rendimientoEsperado.trim() ? parseFloat(rendimientoEsperado) || null : null,
            }
          : {}),
        insumos: items,
      })
      if (result?.error) { setError(result.error); return }
      setSaved(true)
    })
  }

  function handleGuardarCombo() {
    setError(null)
    setSaved(false)

    const items = lineasComponente
      .filter((l) => l.productoId !== '')
      .map((l) => ({
        productoId: l.productoId as number,
        cantidad: parseInt(l.cantidad) || 1,
      }))

    if (items.length === 0) { setError('Agrega al menos un producto componente.'); return }

    startTransition(async () => {
      const result = await guardarComboComponentes(producto.id, items)
      if (result?.error) { setError(result.error); return }
      setSaved(true)
    })
  }

  function handleGuardarSlots() {
    setErrorSlots(null)
    setSavedSlots(false)

    if (lineasSlot.some((s) => !s.nombre.trim())) {
      setErrorSlots('Ingresa un nombre para cada slot.')
      return
    }

    const items = lineasSlot.map((s) => ({
      nombre: s.nombre.trim(),
      requerido: s.requerido,
      productoIds: s.productoIds,
    }))

    startTransitionSlots(async () => {
      const result = await guardarComboSlots(producto.id, items)
      if (result?.error) { setErrorSlots(result.error); return }
      setSavedSlots(true)
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="border-t border-[#E5E5EA] pt-4">
      <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-text-3">
        {producto.es_combo ? 'Componentes del combo' : 'Receta'}
      </label>

      {loading ? (
        <p className="text-[13px] text-text-4">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          {producto.es_combo ? (
            <>
              {candidatosCombo.length === 0 && (
                <p className="text-[13px] text-text-4">
                  No hay productos disponibles para usar como componentes — deben ser productos
                  normales (no combos).
                </p>
              )}

              <div className="space-y-2">
                {lineasComponente.map((l) => {
                  const subtotal = subtotalLineaComponente(l)
                  return (
                    <div key={l.key} className="flex items-center gap-2">
                      <select
                        value={l.productoId}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : ''
                          setLineasComponente((prev) =>
                            prev.map((x) => (x.key === l.key ? { ...x, productoId: v } : x)),
                          )
                        }}
                        className="min-w-0 flex-[2] rounded-lg border-[1.5px] border-border bg-white px-2.5 py-2 text-[12px] outline-none focus:border-blue-500"
                      >
                        <option value="">Producto…</option>
                        {candidatosCombo.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.cantidad}
                        onChange={(e) =>
                          setLineasComponente((prev) =>
                            prev.map((x) => (x.key === l.key ? { ...x, cantidad: e.target.value } : x)),
                          )
                        }
                        className="w-14 flex-shrink-0 rounded-lg border-[1.5px] border-border bg-white px-2 py-2 text-center text-[12px] outline-none focus:border-blue-500"
                      />
                      <span className="w-20 flex-shrink-0 text-right font-mono text-[11px] text-text-3">
                        {l.productoId === '' ? '' : subtotal === null ? 'incompleto' : `$${fmtMoney(subtotal)}`}
                      </span>
                      <button
                        onClick={() =>
                          setLineasComponente((prev) =>
                            prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev,
                          )
                        }
                        className="flex-shrink-0 text-[13px] text-red-500 active:opacity-60"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setLineasComponente((prev) => [...prev, nuevaLineaComponente()])}
                className="w-full rounded-lg border-[1.5px] border-dashed border-[#D1D1D6] py-2 text-[12px] font-semibold text-text-3 active:bg-s2"
              >
                + Agregar componente
              </button>

              <div className="flex items-center justify-between border-t border-[#F2F2F7] pt-2.5">
                <span className="text-[12px] text-text-3">Costo del combo</span>
                <span
                  className={`font-mono text-[14px] font-bold ${
                    costoTotalCombo === null ? 'text-amber-600' : 'text-text-2'
                  }`}
                >
                  {costoTotalCombo === null ? 'Costo incompleto' : `$${fmtMoney(costoTotalCombo)}`}
                </span>
              </div>

              {saved && <p className="text-[12px] font-medium text-green-600">Componentes guardados.</p>}

              <button
                onClick={handleGuardarCombo}
                disabled={isPending}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-[13px] font-bold text-white active:opacity-80 disabled:opacity-40"
              >
                {isPending ? 'Guardando…' : 'Guardar componentes'}
              </button>

              {/* ── Slots electivos (F7-04): el cliente elige un producto por
                  slot al pedir el combo — independiente de los componentes
                  fijos de arriba. ────────────────────────────────────────── */}
              <div className="border-t border-[#F2F2F7] pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  Slots electivos (el cliente elige)
                </p>

                {errorSlots && (
                  <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorSlots}</div>
                )}

                {candidatosCombo.length === 0 && (
                  <p className="mb-2 text-[13px] text-text-4">
                    No hay productos disponibles para usar como opciones — deben ser productos
                    normales (no combos).
                  </p>
                )}

                <div className="space-y-3">
                  {lineasSlot.map((s) => (
                    <div key={s.key} className="space-y-2 rounded-xl border-[1.5px] border-border bg-white p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={s.nombre}
                          onChange={(e) =>
                            setLineasSlot((prev) =>
                              prev.map((x) => (x.key === s.key ? { ...x, nombre: e.target.value } : x)),
                            )
                          }
                          placeholder="Ej: Bebida a elegir"
                          className="min-w-0 flex-1 rounded-lg border-[1.5px] border-border bg-s2 px-2.5 py-2 text-[12px] outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => setLineasSlot((prev) => prev.filter((x) => x.key !== s.key))}
                          className="flex-shrink-0 text-[13px] text-red-500 active:opacity-60"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-text-2">Requerido</span>
                        <button
                          onClick={() =>
                            setLineasSlot((prev) =>
                              prev.map((x) => (x.key === s.key ? { ...x, requerido: !x.requerido } : x)),
                            )
                          }
                          className={`relative h-[24px] w-[42px] rounded-full transition-colors duration-200 ${
                            s.requerido ? 'bg-blue-600' : 'bg-[#D1D1D6]'
                          }`}
                        >
                          <span
                            className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-200 ${
                              s.requerido ? 'translate-x-[21px]' : 'translate-x-[3px]'
                            }`}
                          />
                        </button>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] text-text-3">Opciones que puede elegir</label>
                        <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border-[1.5px] border-border bg-s2 p-2">
                          {candidatosCombo.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 px-1 py-1 text-[12px]">
                              <input
                                type="checkbox"
                                checked={s.productoIds.includes(p.id)}
                                onChange={() =>
                                  setLineasSlot((prev) =>
                                    prev.map((x) =>
                                      x.key === s.key
                                        ? {
                                            ...x,
                                            productoIds: x.productoIds.includes(p.id)
                                              ? x.productoIds.filter((id) => id !== p.id)
                                              : [...x.productoIds, p.id],
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                className="h-4 w-4 rounded border-border"
                              />
                              <span className="text-text-2">{p.nombre}</span>
                            </label>
                          ))}
                        </div>
                        {s.productoIds.length < 2 && (
                          <p className="mt-1 text-[11px] text-amber-600">
                            ⚠ Con menos de 2 opciones, este slot no le da ninguna opción real al cliente.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setLineasSlot((prev) => [...prev, nuevaLineaSlot()])}
                  className="mt-2 w-full rounded-lg border-[1.5px] border-dashed border-[#D1D1D6] py-2 text-[12px] font-semibold text-text-3 active:bg-s2"
                >
                  + Agregar slot electivo
                </button>

                {savedSlots && (
                  <p className="mt-2 text-[12px] font-medium text-green-600">Slots guardados.</p>
                )}

                <button
                  onClick={handleGuardarSlots}
                  disabled={isPendingSlots}
                  className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-[13px] font-bold text-white active:opacity-80 disabled:opacity-40"
                >
                  {isPendingSlots ? 'Guardando…' : 'Guardar slots'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Selector de modo de preparación */}
              <div>
                <label className="mb-1 block text-[11px] text-text-3">Modo de preparación</label>
                <div className="flex gap-2">
                  {(['por_orden', 'por_lote', 'reventa'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleModoChange(m)}
                      className={`flex-1 rounded-lg py-2 text-[12px] font-semibold transition-all ${
                        modoPreparacion === m ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                      }`}
                    >
                      {m === 'por_orden' ? 'Por orden' : m === 'por_lote' ? 'Por lote' : 'Reventa'}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-text-4">
                  {modoPreparacion === 'por_orden' && 'Se prepara al momento del pedido; descuenta insumos crudos al vender.'}
                  {modoPreparacion === 'por_lote' && 'Se cocina en tandas; el pedido descuenta porciones ya preparadas.'}
                  {modoPreparacion === 'reventa' && 'El artículo mismo es el insumo; 1 unidad vendida descuenta 1 de su stock.'}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-text-3">
                  {modoPreparacion === 'reventa' ? 'Nombre del artículo' : 'Nombre de la receta'}
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={modoPreparacion === 'reventa' ? 'Ej: Llavero agave' : 'Ej: Tacos de bistec'}
                  className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                />
              </div>

              {modoPreparacion !== 'reventa' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-text-3">Rendimiento</label>
                      <input
                        type="text"
                        value={rendimiento}
                        onChange={(e) => setRendimiento(e.target.value)}
                        placeholder="Ej: 10 tacos"
                        className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-text-3">Tiempo prep. (min)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={tiempoPrep}
                        onChange={(e) => setTiempoPrep(e.target.value)}
                        className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] text-text-3">Instrucciones</label>
                    <textarea
                      value={instrucciones}
                      onChange={(e) => setInstrucciones(e.target.value)}
                      rows={4}
                      placeholder="Pasos de preparación…"
                      className="w-full resize-none rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {modoPreparacion === 'por_lote' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-text-3">Porciones disponibles</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      value={porcionesDisponibles}
                      onChange={(e) => setPorcionesDisponibles(e.target.value)}
                      className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-text-3">Rendimiento esperado</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.0001"
                      min="0"
                      value={rendimientoEsperado}
                      onChange={(e) => setRendimientoEsperado(e.target.value)}
                      placeholder="Porciones / unidad insumo"
                      className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {modoPreparacion === 'reventa' ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                    Insumo vinculado
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={lineasInsumo[0]?.insumoId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : ''
                        setLineasInsumo([{ key: lineasInsumo[0]?.key ?? nuevaLineaInsumo().key, insumoId: v, cantidad: '1' }])
                      }}
                      className="min-w-0 flex-1 rounded-lg border-[1.5px] border-border bg-white px-2.5 py-2 text-[12px] outline-none focus:border-blue-500"
                    >
                      <option value="">Insumo…</option>
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>{i.nombre}</option>
                      ))}
                    </select>
                    <span className="w-20 flex-shrink-0 text-right font-mono text-[12px] text-text-3">
                      {lineasInsumo[0]?.insumoId === '' || lineasInsumo[0] === undefined
                        ? ''
                        : costoLineaInsumo(lineasInsumo[0]) === null
                          ? '—'
                          : `$${fmtMoney(costoLineaInsumo(lineasInsumo[0]) as number)}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                    Insumos
                  </p>
                  {(() => {
                    // Agrupación automática: "Siempre" primero, luego un
                    // grupo por cada etiqueta de opción distinta detectada
                    // (sin que el usuario elija nada — ver etiquetaDeLinea).
                    const bloques: { label: string; esVariable: boolean; lineas: LineaInsumo[] }[] = []
                    const indicePorLabel = new Map<string, number>()
                    for (const l of lineasInsumo) {
                      const { label, esVariable } = etiquetaDeLinea(l)
                      let idx = indicePorLabel.get(label)
                      if (idx === undefined) {
                        idx = bloques.length
                        indicePorLabel.set(label, idx)
                        bloques.push({ label, esVariable, lineas: [] })
                      }
                      bloques[idx].lineas.push(l)
                    }
                    bloques.sort((a, b) => Number(a.esVariable) - Number(b.esVariable))

                    return (
                      <div className="space-y-3">
                        {bloques.map((grupo) => (
                          <div key={grupo.label}>
                            <p
                              className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
                                grupo.esVariable ? 'text-amber-600' : 'text-text-4'
                              }`}
                            >
                              {grupo.esVariable ? `Opción: ${grupo.label}` : grupo.label}
                            </p>
                            <div className="space-y-2">
                              {grupo.lineas.map((l) => {
                                const insumo = l.insumoId !== '' ? insumoMap.get(l.insumoId) : undefined
                                const costoLinea = costoLineaInsumo(l)
                                return (
                                  <div key={l.key} className="flex items-center gap-2">
                                    <select
                                      value={l.insumoId}
                                      onChange={(e) => {
                                        const v = e.target.value ? Number(e.target.value) : ''
                                        setLineasInsumo((prev) =>
                                          prev.map((x) => (x.key === l.key ? { ...x, insumoId: v } : x)),
                                        )
                                      }}
                                      className="min-w-0 flex-[2] rounded-lg border-[1.5px] border-border bg-white px-2.5 py-2 text-[12px] outline-none focus:border-blue-500"
                                    >
                                      <option value="">Insumo…</option>
                                      {insumos.map((i) => (
                                        <option key={i.id} value={i.id}>{i.nombre}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.001"
                                      min="0"
                                      value={l.cantidad}
                                      onChange={(e) =>
                                        setLineasInsumo((prev) =>
                                          prev.map((x) => (x.key === l.key ? { ...x, cantidad: e.target.value } : x)),
                                        )
                                      }
                                      placeholder="Cant."
                                      className="w-16 flex-shrink-0 rounded-lg border-[1.5px] border-border bg-white px-2 py-2 text-[12px] outline-none focus:border-blue-500"
                                    />
                                    <span className="w-10 flex-shrink-0 text-[11px] text-text-4">
                                      {insumo?.unidad_medida ?? ''}
                                    </span>
                                    <span className="w-16 flex-shrink-0 text-right font-mono text-[11px] text-text-3">
                                      {l.insumoId === '' ? '' : costoLinea === null ? '—' : `$${fmtMoney(costoLinea)}`}
                                    </span>
                                    <button
                                      onClick={() =>
                                        setLineasInsumo((prev) =>
                                          prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev,
                                        )
                                      }
                                      className="flex-shrink-0 text-[13px] text-red-500 active:opacity-60"
                                    >
                                      ×
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  <button
                    onClick={() => setLineasInsumo((prev) => [...prev, nuevaLineaInsumo()])}
                    className="mt-2 w-full rounded-lg border-[1.5px] border-dashed border-[#D1D1D6] py-2 text-[12px] font-semibold text-text-3 active:bg-s2"
                  >
                    + Agregar insumo
                  </button>

                  {gruposSinRecetaPropia.length > 0 && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                      ⚠ Grupo{gruposSinRecetaPropia.length > 1 ? 's' : ''} requerido
                      {gruposSinRecetaPropia.length > 1 ? 's' : ''} sin ninguna opción con receta propia:{' '}
                      {gruposSinRecetaPropia.map((g) => g.nombre).join(', ')}.
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#F2F2F7] pt-2.5">
                <span className="text-[12px] text-text-3">
                  {modoPreparacion === 'reventa' ? 'Costo del artículo' : 'Costo de la receta'}
                </span>
                <span
                  className={`font-mono text-[14px] font-bold ${
                    costoTotalReceta === null ? 'text-amber-600' : 'text-text-2'
                  }`}
                >
                  {costoTotalReceta === null
                    ? 'Costo incompleto'
                    : `${hayLineaVariable ? '~' : ''}$${fmtMoney(costoTotalReceta)}`}
                </span>
              </div>
              {hayLineaVariable && costoTotalReceta !== null && (
                <p className="text-right text-[10px] text-amber-600">
                  ~ Piso con insumos de siempre — el costo real varía según la opción elegida.
                </p>
              )}

              {saved && <p className="text-[12px] font-medium text-green-600">Receta guardada.</p>}

              <button
                onClick={handleGuardarReceta}
                disabled={isPending}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-[13px] font-bold text-white active:opacity-80 disabled:opacity-40"
              >
                {isPending ? 'Guardando…' : 'Guardar receta'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
