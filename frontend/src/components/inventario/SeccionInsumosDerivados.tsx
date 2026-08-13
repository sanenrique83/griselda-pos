'use client'

import { useEffect, useState } from 'react'
import {
  cargarInsumoReceta,
  guardarInsumoReceta,
  registrarProduccionInsumo,
  type InsumoRecetaLinea,
} from '@/app/(app)/mas/inventario/actions'
import type { InsumoInventario, UnidadMedida } from '@/app/(app)/mas/inventario/page'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type LineaComponente = {
  key: string
  insumoComponenteId: number | ''
  cantidad: string
  unidad: UnidadMedida
}

function nuevaLinea(unidadDefault: UnidadMedida): LineaComponente {
  return { key: Math.random().toString(36).slice(2), insumoComponenteId: '', cantidad: '', unidad: unidadDefault }
}

function fmtCantidad(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 3 })
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface SeccionInsumosDerivadosProps {
  insumos: InsumoInventario[]
}

export function SeccionInsumosDerivados({ insumos }: SeccionInsumosDerivadosProps) {
  const derivados = insumos.filter((i) => i.modo_obtencion === 'derivado')
  const [recetaLineas, setRecetaLineas] = useState<Map<number, InsumoRecetaLinea[]>>(new Map())

  const [sheetReceta, setSheetReceta] = useState<InsumoInventario | null>(null)
  const [sheetProduccion, setSheetProduccion] = useState<InsumoInventario | null>(null)

  // Cargar de una vez la receta de cada insumo derivado, para mostrar el
  // estado (con/sin receta) en la lista sin tener que abrir cada uno.
  useEffect(() => {
    let cancelado = false
    Promise.all(
      derivados.map(async (d) => {
        const res = await cargarInsumoReceta(d.id)
        return [d.id, 'error' in res ? [] : res.lineas] as const
      }),
    ).then((entries) => {
      if (!cancelado) setRecetaLineas(new Map(entries))
    })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivados.map((d) => d.id).join(',')])

  if (derivados.length === 0) {
    return (
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Insumos derivados
          </p>
        </div>
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-text-3">
            Ningún insumo está marcado como &quot;Derivado&quot; todavía.
          </p>
          <p className="mt-1 text-xs text-text-4">
            Márcalo desde Inventario → Insumos (ej. &quot;Adobada preparada&quot;) para poder
            definirle una receta de componentes y registrar producción.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Insumos derivados
        </p>
      </div>
      <div className="divide-y divide-[#F2F2F7]">
        {derivados.map((d) => {
          const lineas = recetaLineas.get(d.id)
          const tieneReceta = (lineas?.length ?? 0) > 0
          return (
            <div key={d.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight">{d.nombre}</p>
                <p className={`mt-0.5 text-xs ${tieneReceta ? 'text-text-3' : 'text-amber-600 font-semibold'}`}>
                  {tieneReceta ? `${lineas!.length} componente${lineas!.length !== 1 ? 's' : ''}` : 'Sin receta de componentes'}
                  {' · '}
                  {fmtCantidad(d.stock_actual)} {d.unidad_medida} en stock
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  onClick={() => setSheetReceta(d)}
                  className="rounded-lg bg-s2 px-2.5 py-1.5 text-[12px] font-semibold text-text-2 active:opacity-70"
                >
                  Receta
                </button>
                <button
                  onClick={() => setSheetProduccion(d)}
                  disabled={!tieneReceta}
                  className="rounded-lg bg-[#173F2E]/10 px-2.5 py-1.5 text-[12px] font-semibold text-[#173F2E] active:opacity-70 disabled:opacity-40"
                >
                  Producir
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {sheetReceta && (
        <SheetReceta
          insumo={sheetReceta}
          insumos={insumos}
          onClose={() => setSheetReceta(null)}
          onGuardado={(lineas) => {
            setRecetaLineas((prev) => new Map(prev).set(sheetReceta.id, lineas))
            setSheetReceta(null)
          }}
        />
      )}

      {sheetProduccion && (
        <SheetProduccion
          insumo={sheetProduccion}
          lineas={recetaLineas.get(sheetProduccion.id) ?? []}
          onClose={() => setSheetProduccion(null)}
        />
      )}
    </div>
  )
}

// ─── Sheet: editar receta de componentes ───────────────────────────────────────

function SheetReceta({
  insumo,
  insumos,
  onClose,
  onGuardado,
}: {
  insumo: InsumoInventario
  insumos: InsumoInventario[]
  onClose: () => void
  onGuardado: (lineas: InsumoRecetaLinea[]) => void
}) {
  const [loading, setLoading] = useState(true)
  const [lineas, setLineas] = useState<LineaComponente[]>([nuevaLinea(insumo.unidad_medida)])
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidatos = insumos.filter((i) => i.id !== insumo.id)
  const insumoMap = new Map(insumos.map((i) => [i.id, i]))

  useEffect(() => {
    setLoading(true)
    cargarInsumoReceta(insumo.id).then((res) => {
      if ('error' in res) { setError(res.error); setLoading(false); return }
      setLineas(
        res.lineas.length > 0
          ? res.lineas.map((l) => ({
              key: Math.random().toString(36).slice(2),
              insumoComponenteId: l.insumoComponenteId,
              cantidad: String(l.cantidad_usada),
              unidad: l.unidad_medida,
            }))
          : [nuevaLinea(insumo.unidad_medida)],
      )
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insumo.id])

  function handleGuardar() {
    const items = lineas
      .filter((l) => l.insumoComponenteId !== '')
      .map((l) => ({
        insumoComponenteId: l.insumoComponenteId as number,
        cantidad_usada: parseFloat(l.cantidad) || 0,
        unidad_medida: l.unidad,
      }))
    setError(null)
    setIsPending(true)
    guardarInsumoReceta(insumo.id, items).then((result) => {
      setIsPending(false)
      if (result?.error) { setError(result.error); return }
      onGuardado(
        items.map((i, idx) => ({
          id: idx,
          insumoComponenteId: i.insumoComponenteId,
          insumoComponenteNombre: insumoMap.get(i.insumoComponenteId)?.nombre ?? '',
          cantidad_usada: i.cantidad_usada,
          unidad_medida: i.unidad_medida,
        })),
      )
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[65] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white">
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Receta de {insumo.nombre}</h2>
          <p className="mt-0.5 text-[12px] text-text-3">
            Componentes que se consumen al producir este insumo.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <p className="text-[13px] text-text-4">Cargando…</p>
          ) : (
            <>
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
              )}
              <div className="space-y-2">
                {lineas.map((l) => (
                  <div key={l.key} className="flex items-center gap-2">
                    <select
                      value={l.insumoComponenteId}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : ''
                        const comp = v === '' ? undefined : insumoMap.get(v)
                        setLineas((prev) =>
                          prev.map((x) =>
                            x.key === l.key
                              ? { ...x, insumoComponenteId: v, unidad: comp?.unidad_medida ?? x.unidad }
                              : x,
                          ),
                        )
                      }}
                      className="min-w-0 flex-[2] rounded-lg border-[1.5px] border-border bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[#173F2E]"
                    >
                      <option value="">Insumo componente…</option>
                      {candidatos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      value={l.cantidad}
                      onChange={(e) =>
                        setLineas((prev) =>
                          prev.map((x) => (x.key === l.key ? { ...x, cantidad: e.target.value } : x)),
                        )
                      }
                      placeholder="Cant."
                      className="w-16 flex-shrink-0 rounded-lg border-[1.5px] border-border bg-white px-2 py-2 text-[12px] outline-none focus:border-[#173F2E]"
                    />
                    <span className="w-10 flex-shrink-0 text-[11px] text-text-4">{l.unidad}</span>
                    <button
                      onClick={() =>
                        setLineas((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev))
                      }
                      className="flex-shrink-0 text-[13px] text-red-500 active:opacity-60"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setLineas((prev) => [...prev, nuevaLinea(insumo.unidad_medida)])}
                className="w-full rounded-lg border-[1.5px] border-dashed border-[#D1D1D6] py-2 text-[12px] font-semibold text-text-3 active:bg-s2"
              >
                + Agregar componente
              </button>
              <p className="text-[11px] text-text-4">
                Cantidades definidas &quot;por 1 tanda&quot; — al registrar producción se
                multiplican por las tandas que hiciste.
              </p>
            </>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] space-y-2">
          <button
            onClick={handleGuardar}
            disabled={isPending || loading}
            className="w-full rounded-xl bg-[#173F2E] py-[14px] text-sm font-bold text-white active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar receta'}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-s2 py-[12px] text-sm font-semibold text-text-3 active:bg-s3"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Sheet: registrar producción ────────────────────────────────────────────

function SheetProduccion({
  insumo,
  lineas,
  onClose,
}: {
  insumo: InsumoInventario
  lineas: InsumoRecetaLinea[]
  onClose: () => void
}) {
  const [tandas, setTandas] = useState('1')
  const [cantidadObtenida, setCantidadObtenida] = useState('')
  const [notas, setNotas] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  const numTandas = parseFloat(tandas) || 0

  function handleRegistrar() {
    const numObtenida = parseFloat(cantidadObtenida)
    if (isNaN(numTandas) || numTandas <= 0) { setError('Ingresa cuántas tandas hiciste.'); return }
    if (isNaN(numObtenida) || numObtenida <= 0) { setError('Ingresa cuánto obtuviste.'); return }
    setError(null)
    setIsPending(true)
    registrarProduccionInsumo({
      insumoId: insumo.id,
      cantidadLote: numTandas,
      cantidadObtenida: numObtenida,
      notas: notas.trim() || null,
    }).then((result) => {
      setIsPending(false)
      if ('error' in result) { setError(result.error); return }
      setResultado(
        `Listo. +${fmtCantidad(numObtenida)} ${insumo.unidad_medida} de ${insumo.nombre}` +
          (result.resultado.rendimientoReal !== null
            ? ` (rendimiento: ${fmtCantidad(result.resultado.rendimientoReal)} ${insumo.unidad_medida}/tanda).`
            : '.'),
      )
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[65] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white">
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Registrar producción</h2>
          <p className="mt-0.5 text-[12px] text-text-3">{insumo.nombre}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {resultado ? (
            <div className="rounded-xl bg-[#173F2E]/5 border border-[#173F2E]/15 px-4 py-3.5 text-sm font-medium text-[#173F2E]">
              {resultado}
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  ¿Cuántas tandas hiciste?
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={tandas}
                  onChange={(e) => setTandas(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
                />
              </div>

              {/* Vista previa en vivo del consumo por componente */}
              <div className="rounded-xl border border-[#E5E5EA] overflow-hidden">
                <div className="bg-s2 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                    Se va a consumir
                  </p>
                </div>
                <div className="divide-y divide-[#F2F2F7]">
                  {lineas.map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span className="text-text-2">{l.insumoComponenteNombre}</span>
                      <span className="font-mono text-text-3">
                        {numTandas > 0 ? fmtCantidad(l.cantidad_usada * numTandas) : '—'} {l.unidad_medida}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  ¿Cuánto obtuviste realmente?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    value={cantidadObtenida}
                    onChange={(e) => setCantidadObtenida(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 pr-16 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-text-4">
                    {insumo.unidad_medida}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-text-3">
                  Se suma al stock de {insumo.nombre}. Puede diferir de lo teórico por merma o
                  rendimiento real.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Notas (opcional)
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] space-y-2">
          {resultado ? (
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[#173F2E] py-[14px] text-sm font-bold text-white active:scale-[.98]"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                onClick={handleRegistrar}
                disabled={isPending}
                className="w-full rounded-xl bg-[#173F2E] py-[14px] text-sm font-bold text-white active:scale-[.98] disabled:opacity-40"
              >
                {isPending ? 'Registrando…' : 'Registrar producción'}
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-s2 py-[12px] text-sm font-semibold text-text-3 active:bg-s3"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
