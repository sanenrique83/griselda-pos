'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearInsumo,
  actualizarInsumo,
  eliminarInsumo,
  crearTipoInsumo,
  actualizarTipoInsumo,
  eliminarTipoInsumo,
  reordenarTiposInsumo,
} from '@/app/(app)/mas/inventario/actions'
import type { InsumoInventario, UnidadMedida, ModoObtencionInsumo, TipoInsumo } from '@/app/(app)/mas/inventario/page'
import { ListaArrastrable } from '@/components/catalogo/ListaArrastrable'

const UNIDADES: UnidadMedida[] = ['kg', 'g', 'l', 'ml', 'pieza', 'paquete']

function fmtCantidad(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 3 })
}

interface SeccionInsumosProps {
  insumos: InsumoInventario[]
  tiposInsumo: TipoInsumo[]
}

type FiltroTab = 'todos' | 'sin_clasificar' | number

export function SeccionInsumos({ insumos: initial, tiposInsumo: tiposInicial }: SeccionInsumosProps) {
  const router = useRouter()
  const [insumos, setInsumos] = useState(initial)
  const [tiposInsumo, setTiposInsumo] = useState(tiposInicial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [filtroTab, setFiltroTab] = useState<FiltroTab>('todos')

  type SheetMode = { tipo: 'none' } | { tipo: 'nuevo' } | { tipo: 'editar'; ins: InsumoInventario }
  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })
  const [formError, setFormError] = useState<string | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formUnidad, setFormUnidad] = useState<UnidadMedida>('kg')
  const [formStockMinimo, setFormStockMinimo] = useState('')
  const [formModoObtencion, setFormModoObtencion] = useState<ModoObtencionInsumo>('comprado')
  const [formTipoInsumoId, setFormTipoInsumoId] = useState<number | null>(null)

  // ── Gestión de tipos (sheet aparte) ────────────────────────────────────────
  const [sheetTiposOpen, setSheetTiposOpen] = useState(false)
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('')
  const [tipoEditandoId, setTipoEditandoId] = useState<number | null>(null)
  const [tipoEditandoNombre, setTipoEditandoNombre] = useState('')
  const [tiposError, setTiposError] = useState<string | null>(null)
  const [, startTiposTransition] = useTransition()

  function abrirSheet(mode: SheetMode) {
    setFormError(null)
    if (mode.tipo === 'editar') {
      setFormNombre(mode.ins.nombre)
      setFormUnidad(mode.ins.unidad_medida)
      setFormStockMinimo(mode.ins.stock_minimo.toString())
      setFormModoObtencion(mode.ins.modo_obtencion)
      setFormTipoInsumoId(mode.ins.tipo_insumo_id)
    } else {
      setFormNombre('')
      setFormUnidad('kg')
      setFormStockMinimo('')
      setFormModoObtencion('comprado')
      setFormTipoInsumoId(typeof filtroTab === 'number' ? filtroTab : null)
    }
    setSheet(mode)
  }

  function handleGuardar() {
    if (!formNombre.trim()) { setFormError('Ingresa un nombre.'); return }
    const stockMinimo = formStockMinimo === '' ? 0 : parseFloat(formStockMinimo)
    if (isNaN(stockMinimo) || stockMinimo < 0) { setFormError('El stock mínimo no es válido.'); return }
    setFormError(null)

    if (sheet.tipo === 'nuevo') {
      startTransition(async () => {
        const result = await crearInsumo({
          nombre: formNombre.trim(),
          unidadMedida: formUnidad,
          stockMinimo,
          modoObtencion: formModoObtencion,
          tipoInsumoId: formTipoInsumoId,
        })
        if ('error' in result) { setFormError(result.error); return }
        setInsumos((prev) => [
          ...prev,
          {
            id: result.id,
            nombre: formNombre.trim(),
            unidad_medida: formUnidad,
            stock_actual: 0,
            stock_minimo: stockMinimo,
            activo: true,
            modo_obtencion: formModoObtencion,
            tipo_insumo_id: formTipoInsumoId,
          },
        ].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'editar') {
      const insId = sheet.ins.id
      startTransition(async () => {
        const result = await actualizarInsumo(insId, {
          nombre: formNombre.trim(),
          unidadMedida: formUnidad,
          stockMinimo,
          modoObtencion: formModoObtencion,
          tipoInsumoId: formTipoInsumoId,
        })
        if (result?.error) { setFormError(result.error); return }
        setInsumos((prev) =>
          prev.map((i) => i.id === insId
            ? {
                ...i,
                nombre: formNombre.trim(),
                unidad_medida: formUnidad,
                stock_minimo: stockMinimo,
                modo_obtencion: formModoObtencion,
                tipo_insumo_id: formTipoInsumoId,
              }
            : i)
        )
        setSheet({ tipo: 'none' })
      })
    }
  }

  function handleEliminar(id: number) {
    setError(null)
    startTransition(async () => {
      const result = await eliminarInsumo(id)
      if (result?.error) { setError(result.error); return }
      setInsumos((prev) => prev.filter((i) => i.id !== id))
    })
  }

  // ── Handlers de tipos ──────────────────────────────────────────────────────

  function abrirSheetTipos() {
    setTiposError(null)
    setNuevoTipoNombre('')
    setTipoEditandoId(null)
    setSheetTiposOpen(true)
  }

  function handleCrearTipo() {
    if (!nuevoTipoNombre.trim()) return
    const nombre = nuevoTipoNombre.trim()
    startTiposTransition(async () => {
      const result = await crearTipoInsumo(nombre)
      if ('error' in result) { setTiposError(result.error); return }
      setTiposInsumo((prev) => [...prev, { id: result.id, nombre, orden: prev.length }])
      setNuevoTipoNombre('')
    })
  }

  function abrirEditarTipo(t: TipoInsumo) {
    setTipoEditandoId(t.id)
    setTipoEditandoNombre(t.nombre)
  }

  function handleGuardarTipo() {
    if (tipoEditandoId === null || !tipoEditandoNombre.trim()) return
    const id = tipoEditandoId
    const nombre = tipoEditandoNombre.trim()
    startTiposTransition(async () => {
      const result = await actualizarTipoInsumo(id, nombre)
      if (result?.error) { setTiposError(result.error); return }
      setTiposInsumo((prev) => prev.map((t) => (t.id === id ? { ...t, nombre } : t)))
      setTipoEditandoId(null)
    })
  }

  function handleEliminarTipo(id: number) {
    startTiposTransition(async () => {
      const result = await eliminarTipoInsumo(id)
      if (result?.error) { setTiposError(result.error); return }
      setTiposInsumo((prev) => prev.filter((t) => t.id !== id))
      // Los insumos de este tipo caen a "Sin clasificar" (ON DELETE SET NULL en BD).
      setInsumos((prev) => prev.map((i) => (i.tipo_insumo_id === id ? { ...i, tipo_insumo_id: null } : i)))
      if (filtroTab === id) setFiltroTab('todos')
      router.refresh()
    })
  }

  function handleReordenarTipos(nuevoOrden: TipoInsumo[]) {
    setTiposInsumo(nuevoOrden)
    startTiposTransition(async () => {
      const result = await reordenarTiposInsumo(nuevoOrden.map((t) => t.id))
      if (result?.error) setTiposError(result.error)
    })
  }

  const sheetOpen = sheet.tipo !== 'none'

  const insumosFiltrados =
    filtroTab === 'todos'
      ? insumos
      : filtroTab === 'sin_clasificar'
        ? insumos.filter((i) => i.tipo_insumo_id === null)
        : insumos.filter((i) => i.tipo_insumo_id === filtroTab)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      {/* Sub-pestañas por tipo de insumo */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFiltroTab('todos')}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
              filtroTab === 'todos' ? 'bg-blue-600 text-white' : 'bg-white text-text-2 border border-[#D1D1D6]'
            }`}
          >
            Todos
          </button>
          {tiposInsumo.map((t) => (
            <button
              key={t.id}
              onClick={() => setFiltroTab(t.id)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                filtroTab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-text-2 border border-[#D1D1D6]'
              }`}
            >
              {t.nombre}
            </button>
          ))}
          <button
            onClick={() => setFiltroTab('sin_clasificar')}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
              filtroTab === 'sin_clasificar' ? 'bg-blue-600 text-white' : 'bg-white text-text-2 border border-[#D1D1D6]'
            }`}
          >
            Sin clasificar
          </button>
        </div>
        <button
          onClick={abrirSheetTipos}
          className="flex-shrink-0 rounded-full border border-[#D1D1D6] bg-white px-3 py-1.5 text-[13px] font-semibold text-text-2 active:opacity-60"
          title="Crear, renombrar, eliminar o reordenar tipos"
        >
          ⚙️ Tipos
        </button>
      </div>

      {insumosFiltrados.length > 0 ? (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="divide-y divide-[#F2F2F7]">
            {insumosFiltrados.map((ins) => {
              const sinStock = ins.stock_actual <= 0
              const bajoStock = !sinStock && ins.stock_actual < ins.stock_minimo
              return (
                <div
                  key={ins.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    sinStock ? 'bg-red-50' : bajoStock ? 'bg-amber-50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{ins.nombre}</p>
                    <p
                      className={`mt-0.5 text-xs ${
                        sinStock ? 'font-semibold text-red-600' : bajoStock ? 'font-semibold text-amber-600' : 'text-text-3'
                      }`}
                    >
                      {fmtCantidad(ins.stock_actual)} {ins.unidad_medida} · mínimo {fmtCantidad(ins.stock_minimo)} {ins.unidad_medida}
                      {sinStock && ' · Sin stock'}
                      {bajoStock && ' · Stock bajo'}
                    </p>
                  </div>

                  <button
                    onClick={() => abrirSheet({ tipo: 'editar', ins })}
                    className="flex-shrink-0 text-[12px] font-medium text-blue-600 active:opacity-60"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(ins.id)}
                    disabled={isPending}
                    className="flex-shrink-0 text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card px-4 py-10 text-center">
          <p className="text-sm text-text-3">
            {insumos.length === 0 ? 'Sin insumos configurados.' : 'Sin insumos en esta pestaña.'}
          </p>
        </div>
      )}

      <button
        onClick={() => abrirSheet({ tipo: 'nuevo' })}
        className="w-full rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-sm font-semibold text-text-3 active:bg-s2"
      >
        + Nuevo insumo
      </button>

      {/* ── Bottom Sheet ──────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSheet({ tipo: 'none' })}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">
            {sheet.tipo === 'nuevo' ? 'Nuevo insumo' : 'Editar insumo'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Nombre *
            </label>
            <input
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="Ej: Cebolla, Carne de res, Tortilla de maíz…"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Unidad de medida *
            </label>
            <select
              value={formUnidad}
              onChange={(e) => setFormUnidad(e.target.value as UnidadMedida)}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Modo de obtención
            </label>
            <div className="flex gap-2">
              {(['comprado', 'derivado'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormModoObtencion(m)}
                  className={`flex-1 rounded-lg py-2 text-[12px] font-semibold transition-all ${
                    formModoObtencion === m ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                  }`}
                >
                  {m === 'comprado' ? 'Comprado' : 'Derivado'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-text-4">
              {formModoObtencion === 'comprado'
                ? 'Se adquiere ya listo para usar (vía compras).'
                : 'Tiene su propia receta de componentes y se repone por producción en lote — edítala desde Inventario → Recetas.'}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Tipo (opcional)
            </label>
            <select
              value={formTipoInsumoId ?? ''}
              onChange={(e) => setFormTipoInsumoId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Sin clasificar</option>
              {tiposInsumo.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Stock mínimo *
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={formStockMinimo}
              onChange={(e) => setFormStockMinimo(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
            />
            <p className="mt-1 text-[11px] text-text-3">
              Umbral para avisar cuando el stock esté bajo.
            </p>
          </div>

          {sheet.tipo === 'editar' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Stock actual
              </label>
              <div className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm text-text-3">
                {fmtCantidad(sheet.ins.stock_actual)} {sheet.ins.unidad_medida}
              </div>
              <p className="mt-1 text-[11px] text-text-3">
                Se actualiza automáticamente con las compras y movimientos de inventario — no se edita a mano aquí.
              </p>
            </div>
          )}

          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={handleGuardar}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── Bottom Sheet: Tipos de insumo ────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          sheetTiposOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSheetTiposOpen(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          sheetTiposOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Tipos de insumo</h2>
          <p className="mt-0.5 text-xs text-text-3">Arrastra ⠿ para reordenar las pestañas.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {tiposError && (
            <p className="text-sm text-red-600">{tiposError}</p>
          )}

          {tiposInsumo.length > 0 ? (
            <div className="rounded-2xl border border-[#E5E5EA] overflow-hidden">
              <ListaArrastrable
                items={tiposInsumo}
                onReorder={handleReordenarTipos}
                renderItem={(t, dragHandleProps) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 border-b border-[#F2F2F7] px-3 py-2.5 last:border-0"
                  >
                    <span
                      {...dragHandleProps}
                      className="flex-shrink-0 cursor-grab touch-none text-text-4 active:cursor-grabbing"
                      title="Arrastra para reordenar"
                    >
                      ⠿
                    </span>
                    {tipoEditandoId === t.id ? (
                      <>
                        <input
                          type="text"
                          value={tipoEditandoNombre}
                          onChange={(e) => setTipoEditandoNombre(e.target.value)}
                          autoFocus
                          className="flex-1 rounded-lg border-[1.5px] border-blue-400 bg-white px-2.5 py-1.5 text-[13px] outline-none"
                        />
                        <button
                          onClick={handleGuardarTipo}
                          className="flex-shrink-0 text-[12px] font-semibold text-blue-600 active:opacity-60"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setTipoEditandoId(null)}
                          className="flex-shrink-0 text-[12px] font-medium text-text-3 active:opacity-60"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-[13px]">{t.nombre}</span>
                        <button
                          onClick={() => abrirEditarTipo(t)}
                          className="flex-shrink-0 text-[12px] font-medium text-blue-600 active:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleEliminarTipo(t.id)}
                          className="flex-shrink-0 text-[12px] font-medium text-red-500 active:opacity-60"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                )}
              />
            </div>
          ) : (
            <p className="text-sm text-text-3">Sin tipos configurados todavía.</p>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={nuevoTipoNombre}
              onChange={(e) => setNuevoTipoNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCrearTipo() }}
              placeholder="Ej: Carnes, Guisados…"
              className="flex-1 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
            />
            <button
              onClick={handleCrearTipo}
              disabled={!nuevoTipoNombre.trim()}
              className="flex-shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white active:scale-[.98] disabled:opacity-40"
            >
              + Agregar
            </button>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={() => setSheetTiposOpen(false)}
            className="w-full rounded-xl bg-s2 py-[14px] text-sm font-bold text-text-2 active:scale-[.98]"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
