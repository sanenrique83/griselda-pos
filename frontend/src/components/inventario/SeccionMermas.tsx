'use client'

import { useState, useTransition } from 'react'
import { registrarMerma, obtenerMermas } from '@/app/(app)/mas/inventario/actions'
import type { InsumoInventario, MermaItem, MermaFiltros } from '@/app/(app)/mas/inventario/page'

const MOTIVOS_MERMA = ['Caducado', 'Mal manejo', 'Derrame', 'Otro']

function fmtCantidad(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 3 })
}

function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

type Vista = 'detalle' | 'insumo' | 'motivo'

// ─── Agrupaciones ───────────────────────────────────────────────────────────
// "Por insumo" suma cantidad_total porque todas las filas de un mismo insumo
// comparten unidad. "Por motivo" NO suma cantidades entre insumos distintos
// (kg + litros no se pueden sumar) — en su lugar desglosa por insumo dentro
// de cada motivo, cada uno con su propia unidad.

type GrupoInsumo = {
  insumoId: number
  insumoNombre: string
  unidadMedida: string
  cantidadTotal: number
  count: number
}

function agruparPorInsumo(mermas: MermaItem[]): GrupoInsumo[] {
  const map = new Map<number, GrupoInsumo>()
  for (const m of mermas) {
    const entry = map.get(m.insumoId) ?? {
      insumoId: m.insumoId,
      insumoNombre: m.insumoNombre,
      unidadMedida: m.unidadMedida,
      cantidadTotal: 0,
      count: 0,
    }
    entry.cantidadTotal += m.cantidad
    entry.count += 1
    map.set(m.insumoId, entry)
  }
  return [...map.values()].sort((a, b) => b.cantidadTotal - a.cantidadTotal)
}

type GrupoMotivo = {
  motivo: string
  count: number
  porInsumo: { insumoNombre: string; cantidad: number; unidadMedida: string }[]
}

function agruparPorMotivo(mermas: MermaItem[]): GrupoMotivo[] {
  const map = new Map<string, GrupoMotivo>()
  for (const m of mermas) {
    const entry = map.get(m.motivo) ?? { motivo: m.motivo, count: 0, porInsumo: [] }
    entry.count += 1
    const linea = entry.porInsumo.find((l) => l.insumoNombre === m.insumoNombre)
    if (linea) linea.cantidad += m.cantidad
    else entry.porInsumo.push({ insumoNombre: m.insumoNombre, cantidad: m.cantidad, unidadMedida: m.unidadMedida })
    map.set(m.motivo, entry)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface SeccionMermasProps {
  insumos: InsumoInventario[]
  mermas: MermaItem[]
  filtrosIniciales: MermaFiltros
}

export function SeccionMermas({ insumos, mermas: initial, filtrosIniciales }: SeccionMermasProps) {
  const [mermas, setMermas] = useState(initial)
  const [desde, setDesde] = useState(filtrosIniciales.desde)
  const [hasta, setHasta] = useState(filtrosIniciales.hasta)
  const [insumoFiltroId, setInsumoFiltroId] = useState<number | ''>(filtrosIniciales.insumoId ?? '')
  const [vista, setVista] = useState<Vista>('detalle')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleFiltrar() {
    setError(null)
    startTransition(async () => {
      const result = await obtenerMermas({
        desde,
        hasta,
        insumoId: insumoFiltroId === '' ? null : insumoFiltroId,
      })
      if ('error' in result) { setError(result.error); return }
      setMermas(result)
    })
  }

  function handleRegistrado() {
    setSheetOpen(false)
    handleFiltrar()
  }

  const porInsumo = agruparPorInsumo(mermas)
  const porMotivo = agruparPorMotivo(mermas)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      <button
        onClick={() => setSheetOpen(true)}
        className="block w-full rounded-2xl bg-blue-600 py-3.5 text-center text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,.25)] active:scale-[.98]"
      >
        + Registrar merma
      </button>

      {/* Filtros */}
      <div className="rounded-2xl bg-white shadow-card px-4 py-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-2.5 py-2 text-[13px] outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-2.5 py-2 text-[13px] outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <select
          value={insumoFiltroId}
          onChange={(e) => setInsumoFiltroId(e.target.value ? Number(e.target.value) : '')}
          className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-2.5 py-2 text-[13px] outline-none focus:border-blue-500"
        >
          <option value="">Todos los insumos</option>
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
          ))}
        </select>
        <button
          onClick={handleFiltrar}
          disabled={isPending}
          className="w-full rounded-lg bg-s2 py-2.5 text-[13px] font-semibold text-text-2 active:opacity-70 disabled:opacity-40"
        >
          {isPending ? 'Filtrando…' : 'Aplicar filtro'}
        </button>
      </div>

      {/* Selector de vista */}
      <div className="flex gap-2">
        {([
          { id: 'detalle', label: 'Detalle' },
          { id: 'insumo', label: 'Por insumo' },
          { id: 'motivo', label: 'Por motivo' },
        ] as const).map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={`flex-1 rounded-lg py-2 text-[12px] font-semibold transition-all ${
              vista === v.id ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {mermas.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card px-4 py-10 text-center">
          <p className="text-sm text-text-3">Sin mermas registradas en este rango.</p>
        </div>
      ) : vista === 'detalle' ? (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden divide-y divide-[#F2F2F7]">
          {mermas.map((m) => (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{m.insumoNombre}</p>
                <p className="flex-shrink-0 font-mono text-sm font-semibold text-red-600">
                  -{fmtCantidad(m.cantidad)} {m.unidadMedida}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-text-3">
                {m.motivo} · {fmtFechaHora(m.createdAt)} · {m.usuarioNombre}
              </p>
            </div>
          ))}
        </div>
      ) : vista === 'insumo' ? (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden divide-y divide-[#F2F2F7]">
          {porInsumo.map((g) => (
            <div key={g.insumoId} className="flex items-center justify-between gap-2 px-4 py-3">
              <p className="truncate text-sm font-medium">{g.insumoNombre}</p>
              <div className="flex-shrink-0 text-right">
                <p className="font-mono text-sm font-semibold text-red-600">
                  -{fmtCantidad(g.cantidadTotal)} {g.unidadMedida}
                </p>
                <p className="text-[11px] text-text-3">
                  {g.count} merma{g.count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden divide-y divide-[#F2F2F7]">
          {porMotivo.map((g) => (
            <div key={g.motivo} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{g.motivo}</p>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                  {g.count}
                </span>
              </div>
              <div className="mt-1.5 space-y-0.5">
                {g.porInsumo.map((l) => (
                  <div key={l.insumoNombre} className="flex items-center justify-between text-[12px]">
                    <span className="text-text-3">{l.insumoNombre}</span>
                    <span className="font-mono text-text-2">
                      -{fmtCantidad(l.cantidad)} {l.unidadMedida}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sheetOpen && (
        <SheetMerma insumos={insumos} onClose={() => setSheetOpen(false)} onRegistrado={handleRegistrado} />
      )}
    </div>
  )
}

// ─── Sheet: registrar merma ────────────────────────────────────────────────

function SheetMerma({
  insumos,
  onClose,
  onRegistrado,
}: {
  insumos: InsumoInventario[]
  onClose: () => void
  onRegistrado: () => void
}) {
  const [insumoId, setInsumoId] = useState<number | ''>('')
  const [cantidad, setCantidad] = useState('')
  const [motivoIdx, setMotivoIdx] = useState(0)
  const [motivoOtro, setMotivoOtro] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insumo = insumos.find((i) => i.id === insumoId)
  const esOtro = MOTIVOS_MERMA[motivoIdx] === 'Otro'

  function handleRegistrar() {
    if (insumoId === '') { setError('Selecciona un insumo.'); return }
    const numCantidad = parseFloat(cantidad)
    if (isNaN(numCantidad) || numCantidad <= 0) { setError('Ingresa una cantidad válida.'); return }
    if (esOtro && !motivoOtro.trim()) { setError('Describe el motivo.'); return }
    setError(null)
    setIsPending(true)
    registrarMerma({
      insumoId,
      cantidad: numCantidad,
      motivo: esOtro ? motivoOtro.trim() : MOTIVOS_MERMA[motivoIdx],
    }).then((result) => {
      setIsPending(false)
      if ('error' in result) { setError(result.error); return }
      onRegistrado()
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[65] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white">
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Registrar merma</h2>
          <p className="mt-0.5 text-[12px] text-text-3">
            Producto echado a perder, derramado o dañado — se descuenta del stock.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Insumo
            </label>
            <select
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Selecciona un insumo…</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Cantidad
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 pr-16 text-sm outline-none focus:border-blue-500 focus:bg-white"
              />
              {insumo && (
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-text-4">
                  {insumo.unidad_medida}
                </span>
              )}
            </div>
            {insumo && (
              <p className="mt-1 text-[11px] text-text-3">
                Stock actual: {fmtCantidad(insumo.stock_actual)} {insumo.unidad_medida}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Motivo
            </label>
            <div className="space-y-2">
              {MOTIVOS_MERMA.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setMotivoIdx(idx)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    motivoIdx === idx
                      ? 'bg-blue-50 border-[1.5px] border-blue-300'
                      : 'bg-s2 border-[1.5px] border-transparent'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white transition-all ${
                      motivoIdx === idx ? 'border-blue-500 bg-blue-500' : 'border-border'
                    }`}
                  >
                    {motivoIdx === idx && '✓'}
                  </div>
                  <span className="text-[14px] font-medium">{m}</span>
                </button>
              ))}
            </div>
            {esOtro && (
              <input
                type="text"
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                placeholder="Describe el motivo…"
                className="mt-2 w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
              />
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] space-y-2">
          <button
            onClick={handleRegistrar}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Registrando…' : 'Registrar merma'}
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
