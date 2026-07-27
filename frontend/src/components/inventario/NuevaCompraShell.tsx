'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registrarCompra } from '@/app/(app)/mas/inventario/actions'
import type { UnidadMedida } from '@/app/(app)/mas/inventario/page'

type ProveedorSimple = { id: number; nombre: string }
type InsumoSimple = { id: number; nombre: string; unidad_medida: UnidadMedida }

interface LineaCompra {
  key: string
  insumoId: number | ''
  cantidad: string
  costoUnitario: string
}

function nuevaLinea(): LineaCompra {
  return { key: Math.random().toString(36).slice(2), insumoId: '', cantidad: '', costoUnitario: '' }
}

function fechaHoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function subtotalLinea(l: LineaCompra): number {
  const cant = parseFloat(l.cantidad)
  const costo = parseFloat(l.costoUnitario)
  if (isNaN(cant) || isNaN(costo)) return 0
  return cant * costo
}

interface NuevaCompraShellProps {
  proveedores: ProveedorSimple[]
  insumos: InsumoSimple[]
}

export function NuevaCompraShell({ proveedores, insumos }: NuevaCompraShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [fecha, setFecha] = useState(fechaHoyLocal())
  const [numeroNota, setNumeroNota] = useState('')
  const [lineas, setLineas] = useState<LineaCompra[]>([nuevaLinea()])
  const [error, setError] = useState<string | null>(null)

  const insumoMap = new Map(insumos.map((i) => [i.id, i]))
  const total = lineas.reduce((s, l) => s + subtotalLinea(l), 0)

  function actualizarLinea(key: string, patch: Partial<LineaCompra>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function quitarLinea(key: string) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }

  function handleGuardar() {
    setError(null)

    if (proveedorId === '') { setError('Selecciona un proveedor.'); return }

    const lineasConInsumo = lineas.filter((l) => l.insumoId !== '')
    if (lineasConInsumo.length === 0) { setError('Agrega al menos un insumo.'); return }

    for (const l of lineasConInsumo) {
      const nombre = insumoMap.get(l.insumoId as number)?.nombre ?? 'insumo'
      const cant = parseFloat(l.cantidad)
      const costo = parseFloat(l.costoUnitario)
      if (isNaN(cant) || cant <= 0) { setError(`Cantidad inválida para "${nombre}".`); return }
      if (isNaN(costo) || costo < 0) { setError(`Costo unitario inválido para "${nombre}".`); return }
    }

    startTransition(async () => {
      const result = await registrarCompra({
        proveedorId: proveedorId as number,
        fecha,
        numeroNota: numeroNota.trim() || null,
        items: lineasConInsumo.map((l) => ({
          insumoId: l.insumoId as number,
          cantidad: parseFloat(l.cantidad),
          costoUnitario: parseFloat(l.costoUnitario),
        })),
      })
      if ('error' in result) { setError(result.error); return }
      router.push('/mas/inventario?tab=compras')
    })
  }

  return (
    <div
      className="flex flex-col bg-s2"
      style={{ minHeight: 'calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))' }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[#E5E5EA] bg-white">
        <div className="flex items-center gap-2 px-4 pt-3 pb-3">
          <button
            onClick={() => router.push('/mas/inventario?tab=compras')}
            className="-ml-1 px-1 py-1 text-[15px] font-medium text-blue-600 active:opacity-60"
          >
            ‹ Inventario
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[15px] font-semibold leading-tight">Nueva compra</p>
          </div>
          <div className="w-[76px]" />
        </div>
      </div>

      {/* ── Cuerpo scrolleable ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {/* Encabezado de la compra */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Datos de la compra
            </p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Proveedor *
              </label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Seleccionar…</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {proveedores.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-600">
                  No hay proveedores activos — crea uno primero en la pestaña Proveedores.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  N° de nota (opcional)
                </label>
                <input
                  type="text"
                  value={numeroNota}
                  onChange={(e) => setNumeroNota(e.target.value)}
                  placeholder="Ej: A-1234"
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Líneas de compra */}
        <div className="space-y-2">
          {lineas.map((l, idx) => {
            const insumo = l.insumoId !== '' ? insumoMap.get(l.insumoId) : undefined
            return (
              <div key={l.key} className="rounded-2xl bg-white shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                    Insumo {idx + 1}
                  </p>
                  {lineas.length > 1 && (
                    <button
                      onClick={() => quitarLinea(l.key)}
                      className="text-[12px] font-medium text-red-500 active:opacity-60"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <select
                    value={l.insumoId}
                    onChange={(e) => actualizarLinea(l.key, { insumoId: e.target.value ? Number(e.target.value) : '' })}
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar insumo…</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-text-3">
                        Cantidad {insumo ? `(${insumo.unidad_medida})` : ''}
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min="0"
                        value={l.cantidad}
                        onChange={(e) => actualizarLinea(l.key, { cantidad: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-text-3">
                        Costo unitario
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={l.costoUnitario}
                        onChange={(e) => actualizarLinea(l.key, { costoUnitario: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#F2F2F7] pt-2.5">
                    <span className="text-[11px] text-text-3">Subtotal</span>
                    <span className="font-mono text-sm font-bold text-text-2">
                      ${fmtMoney(subtotalLinea(l))}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={() => setLineas((prev) => [...prev, nuevaLinea()])}
          className="w-full rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-sm font-semibold text-text-3 active:bg-s2"
        >
          + Agregar insumo
        </button>

        <div className="h-2" />
      </div>

      {/* ── Pie fijo ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[#E5E5EA] bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] text-text-3">Total de la compra</p>
          <span className="font-mono text-[22px] font-bold text-green-600">
            ${fmtMoney(total)}
          </span>
        </div>
        <button
          onClick={handleGuardar}
          disabled={isPending}
          className="w-full rounded-xl bg-blue-600 py-[18px] text-base font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,.35)] active:scale-[.98] disabled:opacity-40"
        >
          {isPending ? 'Guardando…' : '✓ Registrar compra'}
        </button>
      </div>
    </div>
  )
}
