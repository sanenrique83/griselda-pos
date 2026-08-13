'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearArea,
  actualizarArea,
  eliminarArea,
  crearMesa,
  actualizarMesa,
  eliminarMesa,
} from '@/app/(app)/mas/catalogo/actions'
import type { AreaCatalogo, MesaCatalogo } from '@/app/(app)/mas/catalogo/page'

interface SeccionMesasProps {
  areas: AreaCatalogo[]
}

export function SeccionMesas({ areas: initialAreas }: SeccionMesasProps) {
  const router = useRouter()
  const [areas, setAreas] = useState(initialAreas)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Sheet estado
  type SheetMode =
    | { tipo: 'none' }
    | { tipo: 'nueva-area' }
    | { tipo: 'editar-area'; area: AreaCatalogo }
    | { tipo: 'nueva-mesa'; areaId: number }
    | { tipo: 'editar-mesa'; mesa: MesaCatalogo; areaId: number }

  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })

  // Form fields
  const [formNombre, setFormNombre] = useState('')
  const [formNumero, setFormNumero] = useState('')
  const [formCapacidad, setFormCapacidad] = useState('')

  function abrirSheet(mode: SheetMode) {
    setError(null)
    if (mode.tipo === 'editar-area') {
      setFormNombre(mode.area.nombre)
    } else if (mode.tipo === 'nueva-area') {
      setFormNombre('')
    } else if (mode.tipo === 'nueva-mesa') {
      setFormNombre('')
      setFormNumero('')
      setFormCapacidad('')
    } else if (mode.tipo === 'editar-mesa') {
      setFormNombre(mode.mesa.nombre ?? '')
      setFormNumero(mode.mesa.numero.toString())
      setFormCapacidad(mode.mesa.capacidad?.toString() ?? '')
    }
    setSheet(mode)
  }

  function handleGuardar() {
    setError(null)
    if (sheet.tipo === 'nueva-area') {
      if (!formNombre.trim()) { setError('Ingresa un nombre.'); return }
      startTransition(async () => {
        const result = await crearArea(formNombre.trim())
        if ('error' in result) { setError(result.error); return }
        router.refresh()
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'editar-area') {
      if (!formNombre.trim()) { setError('Ingresa un nombre.'); return }
      const areaId = sheet.area.id
      startTransition(async () => {
        const result = await actualizarArea(areaId, formNombre.trim())
        if (result?.error) { setError(result.error); return }
        setAreas((prev) =>
          prev.map((a) => a.id === areaId ? { ...a, nombre: formNombre.trim() } : a)
        )
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'nueva-mesa') {
      const num = parseInt(formNumero)
      if (isNaN(num)) { setError('Ingresa un número de mesa.'); return }
      const areaId = sheet.areaId
      startTransition(async () => {
        const result = await crearMesa({
          areaId,
          numero: num,
          nombre: formNombre.trim() || null,
          capacidad: formCapacidad ? parseInt(formCapacidad) : null,
        })
        if ('error' in result) { setError(result.error); return }
        router.refresh()
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'editar-mesa') {
      const num = parseInt(formNumero)
      if (isNaN(num)) { setError('Ingresa un número de mesa.'); return }
      const mesaId = sheet.mesa.id
      startTransition(async () => {
        const result = await actualizarMesa(mesaId, {
          numero: num,
          nombre: formNombre.trim() || null,
          capacidad: formCapacidad ? parseInt(formCapacidad) : null,
        })
        if (result?.error) { setError(result.error); return }
        router.refresh()
        setSheet({ tipo: 'none' })
      })
    }
  }

  function handleEliminarArea(id: number) {
    startTransition(async () => {
      const result = await eliminarArea(id)
      if (result?.error) { setError(result.error); return }
      setAreas((prev) => prev.filter((a) => a.id !== id))
    })
  }

  function handleEliminarMesa(id: number) {
    startTransition(async () => {
      const result = await eliminarMesa(id)
      if (result?.error) { setError(result.error); return }
      router.refresh()
    })
  }

  const sheetOpen = sheet.tipo !== 'none'
  const sheetTitle =
    sheet.tipo === 'nueva-area' ? 'Nueva área' :
    sheet.tipo === 'editar-area' ? 'Editar área' :
    sheet.tipo === 'nueva-mesa' ? 'Nueva mesa' :
    sheet.tipo === 'editar-mesa' ? 'Editar mesa' : ''

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      {areas.map((area) => (
        <div key={area.id} className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
            <p className="text-[13px] font-semibold text-text-2">{area.nombre}</p>
            <div className="flex gap-2">
              <button
                onClick={() => abrirSheet({ tipo: 'editar-area', area })}
                className="text-[12px] font-medium text-[#173F2E] active:opacity-60"
              >
                Editar
              </button>
              <button
                onClick={() => handleEliminarArea(area.id)}
                disabled={isPending}
                className="text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#F2F2F7]">
            {area.mesas.map((mesa) => (
              <div key={mesa.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {mesa.nombre ?? `Mesa ${mesa.numero}`}
                    {mesa.nombre && <span className="ml-1.5 text-xs text-text-3">#{mesa.numero}</span>}
                  </p>
                  {mesa.capacidad && (
                    <p className="text-xs text-text-3">{mesa.capacidad} personas</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => abrirSheet({ tipo: 'editar-mesa', mesa, areaId: area.id })}
                    className="text-[12px] font-medium text-[#173F2E] active:opacity-60"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminarMesa(mesa.id)}
                    disabled={isPending}
                    className="text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-[#F2F2F7]">
            <button
              onClick={() => abrirSheet({ tipo: 'nueva-mesa', areaId: area.id })}
              className="text-sm font-semibold text-[#173F2E] active:opacity-60"
            >
              + Agregar mesa
            </button>
          </div>
        </div>
      ))}

      {/* Agregar área */}
      <button
        onClick={() => abrirSheet({ tipo: 'nueva-area' })}
        className="w-full rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-sm font-semibold text-text-3 active:bg-s2"
      >
        + Nueva área
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
          <h2 className="text-[17px] font-bold">{sheetTitle}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {(sheet.tipo === 'nueva-mesa' || sheet.tipo === 'editar-mesa') && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Número de mesa *
              </label>
              <input
                type="number"
                value={formNumero}
                onChange={(e) => setFormNumero(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Nombre {(sheet.tipo === 'nueva-mesa' || sheet.tipo === 'editar-mesa') ? '(opcional)' : '*'}
            </label>
            <input
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder={sheet.tipo === 'nueva-area' || sheet.tipo === 'editar-area' ? 'Ej: Terraza' : 'Ej: Mesa junto a la ventana'}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
            />
          </div>
          {(sheet.tipo === 'nueva-mesa' || sheet.tipo === 'editar-mesa') && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Capacidad (opcional)
              </label>
              <input
                type="number"
                value={formCapacidad}
                onChange={(e) => setFormCapacidad(e.target.value)}
                placeholder="Ej: 4"
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={handleGuardar}
            disabled={isPending}
            className="w-full rounded-xl bg-[#173F2E] py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(23,63,46,.32)] active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
