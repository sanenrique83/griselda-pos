'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { obtenerHistorialCompras } from '@/app/(app)/mas/inventario/actions'
import type { HistorialPrecioItem, ProveedorInventario } from '@/app/(app)/mas/inventario/page'

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** fecha viene como 'YYYY-MM-DD' (columna DATE) — parsear como fecha local, no UTC */
function fmtFecha(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface CompraAgrupada {
  compraId: number
  fecha: string
  numeroNota: string | null
  compraTotal: number
  proveedorNombre: string
  items: HistorialPrecioItem[]
}

function agrupar(historial: HistorialPrecioItem[]): CompraAgrupada[] {
  const map = new Map<number, CompraAgrupada>()
  for (const item of historial) {
    const existing = map.get(item.compraId)
    if (existing) {
      existing.items.push(item)
    } else {
      map.set(item.compraId, {
        compraId: item.compraId,
        fecha: item.fecha,
        numeroNota: item.numeroNota,
        compraTotal: item.compraTotal,
        proveedorNombre: item.proveedorNombre,
        items: [item],
      })
    }
  }
  return [...map.values()]
}

interface SeccionComprasProps {
  historial: HistorialPrecioItem[]
  proveedores: ProveedorInventario[]
}

export function SeccionCompras({ historial: initial, proveedores }: SeccionComprasProps) {
  const [historial, setHistorial] = useState(initial)
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleFiltro(value: string) {
    const id: number | '' = value ? Number(value) : ''
    setProveedorId(id)
    setError(null)
    startTransition(async () => {
      const result = await obtenerHistorialCompras(id === '' ? null : id)
      if ('error' in result) { setError(result.error); return }
      setHistorial(result)
    })
  }

  const compras = agrupar(historial)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      <select
        value={proveedorId}
        onChange={(e) => handleFiltro(e.target.value)}
        className="w-full rounded-xl border-[1.5px] border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
      >
        <option value="">Todos los proveedores</option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </select>

      <Link
        href="/mas/inventario/compras/nueva"
        className="block w-full rounded-2xl bg-blue-600 py-3.5 text-center text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,.25)] active:scale-[.98]"
      >
        + Nueva compra
      </Link>

      {isPending && (
        <p className="text-center text-xs text-text-3">Cargando…</p>
      )}

      {compras.length > 0 ? (
        <div className="space-y-3">
          {compras.map((c) => (
            <div key={c.compraId} className="rounded-2xl bg-white shadow-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E5E5EA] px-4 pt-4 pb-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-text-2">{c.proveedorNombre}</p>
                  <p className="text-[11px] text-text-3">
                    {fmtFecha(c.fecha)}{c.numeroNota ? ` · Nota ${c.numeroNota}` : ''}
                  </p>
                </div>
                <span className="ml-3 flex-shrink-0 font-mono text-sm font-bold text-green-600">
                  ${fmtMoney(c.compraTotal)}
                </span>
              </div>
              <div className="divide-y divide-[#F2F2F7]">
                {c.items.map((item) => (
                  <div key={`${c.compraId}-${item.insumoId}`} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{item.insumoNombre}</p>
                      <p className="flex-shrink-0 font-mono text-sm font-semibold text-text-2">
                        {item.cantidad} {item.unidadMedida} × ${fmtMoney(item.costoUnitario)}
                      </p>
                    </div>
                    <PrecioDelta item={item} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card px-4 py-10 text-center">
          <p className="text-sm text-text-3">Sin compras registradas.</p>
        </div>
      )}
    </div>
  )
}

function PrecioDelta({ item }: { item: HistorialPrecioItem }) {
  if (item.costoUnitarioAnterior === null || item.diferencia === null) {
    return <p className="mt-0.5 text-[11px] text-text-4">Primera compra a este proveedor</p>
  }
  if (item.diferencia > 0) {
    return (
      <p className="mt-0.5 text-[11px] font-semibold text-red-600">
        ▲ +${fmtMoney(item.diferencia)} vs. anterior (${fmtMoney(item.costoUnitarioAnterior)})
      </p>
    )
  }
  if (item.diferencia < 0) {
    return (
      <p className="mt-0.5 text-[11px] font-semibold text-green-600">
        ▼ -${fmtMoney(Math.abs(item.diferencia))} vs. anterior (${fmtMoney(item.costoUnitarioAnterior)})
      </p>
    )
  }
  return <p className="mt-0.5 text-[11px] text-text-3">= sin cambio vs. anterior</p>
}
