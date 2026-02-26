'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearIngrediente,
  actualizarIngrediente,
  eliminarIngrediente,
  toggleIngredienteDisponible,
  setTodosIngredientesDisponibles,
} from '@/app/(app)/mas/catalogo/actions'
import type { IngredienteCatalogo } from '@/app/(app)/mas/catalogo/page'

interface SeccionIngredientesProps {
  ingredientes: IngredienteCatalogo[]
}

export function SeccionIngredientes({ ingredientes: initial }: SeccionIngredientesProps) {
  const router = useRouter()
  const [ingredientes, setIngredientes] = useState(initial)
  const [, startTransition] = useTransition()
  const [isPendingAll, startAll] = useTransition()
  const [isPendingForm, startForm] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  type SheetMode = { tipo: 'none' } | { tipo: 'nuevo' } | { tipo: 'editar'; ing: IngredienteCatalogo }
  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })
  const [formNombre, setFormNombre] = useState('')

  const todosDisponibles = ingredientes.length > 0 && ingredientes.every((i) => i.disponible)
  const disponiblesCount = ingredientes.filter((i) => i.disponible).length

  function handleToggle(id: number) {
    const actual = ingredientes.find((i) => i.id === id)?.disponible ?? true
    setIngredientes((prev) => prev.map((i) => i.id === id ? { ...i, disponible: !actual } : i))
    setError(null)
    startTransition(async () => {
      const result = await toggleIngredienteDisponible(id, !actual)
      if (result?.error) {
        setIngredientes((prev) => prev.map((i) => i.id === id ? { ...i, disponible: actual } : i))
        setError(result.error)
      }
    })
  }

  function handleTodosDisponibles() {
    setIngredientes((prev) => prev.map((i) => ({ ...i, disponible: true })))
    setError(null)
    startAll(async () => {
      const result = await setTodosIngredientesDisponibles()
      if (result?.error) {
        setError(result.error)
        router.refresh()
      }
    })
  }

  function abrirSheet(mode: SheetMode) {
    setFormError(null)
    setFormNombre(mode.tipo === 'editar' ? mode.ing.nombre : '')
    setSheet(mode)
  }

  function handleEliminar(id: number) {
    setError(null)
    startTransition(async () => {
      const result = await eliminarIngrediente(id)
      if (result?.error) { setError(result.error); return }
      setIngredientes((prev) => prev.filter((i) => i.id !== id))
    })
  }

  function handleGuardar() {
    if (!formNombre.trim()) { setFormError('Ingresa un nombre.'); return }
    setFormError(null)

    if (sheet.tipo === 'nuevo') {
      startForm(async () => {
        const result = await crearIngrediente(formNombre.trim())
        if ('error' in result) { setFormError(result.error); return }
        setIngredientes((prev) => [
          ...prev,
          { id: result.id, nombre: formNombre.trim(), disponible: true, creado_en: new Date().toISOString() },
        ].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'editar') {
      const ingId = sheet.ing.id
      startForm(async () => {
        const result = await actualizarIngrediente(ingId, formNombre.trim())
        if (result?.error) { setFormError(result.error); return }
        setIngredientes((prev) =>
          prev.map((i) => i.id === ingId ? { ...i, nombre: formNombre.trim() } : i)
        )
        setSheet({ tipo: 'none' })
      })
    }
  }

  const sheetOpen = sheet.tipo !== 'none'

  return (
    <div className="space-y-4">

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      {/* Contador + botón Todos ✓ */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-3">
          {disponiblesCount} de {ingredientes.length} disponibles
        </p>
        <button
          onClick={handleTodosDisponibles}
          disabled={isPendingAll || todosDisponibles || ingredientes.length === 0}
          className="rounded-xl bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(37,99,235,.25)] active:scale-[.97] disabled:opacity-40"
        >
          {isPendingAll ? '…' : 'Todos ✓'}
        </button>
      </div>

      {/* Lista de ingredientes */}
      {ingredientes.length > 0 ? (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="divide-y divide-[#F2F2F7]">
            {ingredientes.map((ing) => (
              <div key={ing.id} className="flex items-center gap-3 px-4 py-3">
                <p
                  className={`flex-1 text-sm font-medium leading-tight ${
                    !ing.disponible ? 'text-text-4 line-through' : ''
                  }`}
                >
                  {ing.nombre}
                </p>

                {/* Toggle disponible */}
                <button
                  onClick={() => handleToggle(ing.id)}
                  className={`relative flex-shrink-0 h-[24px] w-[42px] rounded-full transition-colors duration-200 ${
                    ing.disponible ? 'bg-green-500' : 'bg-[#D1D1D6]'
                  }`}
                  aria-label={ing.disponible ? 'Marcar agotado' : 'Marcar disponible'}
                >
                  <span
                    className={`absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
                      ing.disponible ? 'translate-x-[20px]' : 'translate-x-[2px]'
                    }`}
                  />
                </button>

                <button
                  onClick={() => abrirSheet({ tipo: 'editar', ing })}
                  className="text-[12px] font-medium text-blue-600 active:opacity-60"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleEliminar(ing.id)}
                  className="text-[12px] font-medium text-red-500 active:opacity-60"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card px-4 py-10 text-center">
          <p className="text-sm text-text-3">Sin ingredientes configurados.</p>
        </div>
      )}

      <button
        onClick={() => abrirSheet({ tipo: 'nuevo' })}
        className="w-full rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-sm font-semibold text-text-3 active:bg-s2"
      >
        + Nuevo ingrediente
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSheet({ tipo: 'none' })}
      />

      {/* Bottom sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">
            {sheet.tipo === 'nuevo' ? 'Nuevo ingrediente' : 'Editar ingrediente'}
          </h2>
        </div>

        <div className="px-4 py-4 space-y-3 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Nombre *
            </label>
            <input
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="Ej: Aguacate, Queso Oaxaca, Cebolla…"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleGuardar}
              disabled={isPendingForm}
              className="flex-[2] rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white active:scale-[.98] disabled:opacity-40"
            >
              {isPendingForm ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => setSheet({ tipo: 'none' })}
              className="flex-1 rounded-xl bg-s2 py-[14px] text-sm font-semibold text-text-3 active:bg-s3"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
