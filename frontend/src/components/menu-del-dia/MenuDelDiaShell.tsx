'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BotonRegresarMas } from '@/components/layout/BotonRegresarMas'
import { setTodosDisponibles } from '@/app/(app)/mas/menu-del-dia/actions'
import { toggleDisponible } from '@/app/(app)/mas/catalogo/actions'
import type { CategoriaMenu } from '@/app/(app)/mas/menu-del-dia/page'

interface MenuDelDiaShellProps {
  categorias: CategoriaMenu[]
  totalProductos: number
  disponibles: number
}

export function MenuDelDiaShell({
  categorias: categoriasInit,
  totalProductos,
  disponibles: disponiblesInit,
}: MenuDelDiaShellProps) {
  const router = useRouter()

  // Estado local optimista
  const [disponibilidad, setDisponibilidad] = useState<Record<number, boolean>>(() => {
    const m: Record<number, boolean> = {}
    for (const cat of categoriasInit) {
      for (const p of cat.productos) {
        m[p.id] = p.disponible
      }
    }
    return m
  })

  const [isPendingAll, startAll] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const disponiblesActuales = Object.values(disponibilidad).filter(Boolean).length

  function handleToggle(productoId: number) {
    const nuevoValor = !disponibilidad[productoId]
    // Optimistic
    setDisponibilidad((prev) => ({ ...prev, [productoId]: nuevoValor }))
    setErrorMsg(null)

    toggleDisponible(productoId, nuevoValor).then((result) => {
      if (result?.error) {
        // Rollback
        setDisponibilidad((prev) => ({ ...prev, [productoId]: !nuevoValor }))
        setErrorMsg(result.error)
      }
    })
  }

  function handleTodosDisponibles() {
    // Optimistic: poner todos en true
    setDisponibilidad((prev) => {
      const next = { ...prev }
      for (const k in next) next[k] = true
      return next
    })
    setErrorMsg(null)
    startAll(async () => {
      const result = await setTodosDisponibles()
      if (result?.error) {
        setErrorMsg(result.error)
        router.refresh()
      }
    })
  }

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <BotonRegresarMas />
        <div className="mt-1 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-[20px] font-bold leading-tight">Menú del día</h1>
            <p className="mt-0.5 text-[13px] text-text-3">
              {disponiblesActuales} de {totalProductos} disponibles
            </p>
          </div>
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={handleTodosDisponibles}
              disabled={isPendingAll || disponiblesActuales === totalProductos}
              className="rounded-xl bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(37,99,235,.25)] active:scale-[.97] disabled:opacity-40"
            >
              {isPendingAll ? '…' : 'Todos ✓'}
            </button>
            <button
              onClick={handleTodosDisponibles}
              disabled={isPendingAll}
              className="rounded-xl bg-s2 border border-[#D1D1D6] px-3 py-2 text-[12px] font-semibold text-text-2 active:scale-[.97] disabled:opacity-40"
            >
              Resetear
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        {categoriasInit.length === 0 && (
          <div className="rounded-2xl bg-white shadow-card px-4 py-10 text-center">
            <p className="text-2xl mb-2">🍽️</p>
            <p className="text-sm text-text-3">No hay productos activos en el catálogo.</p>
          </div>
        )}

        {categoriasInit.map((cat) => {
          const prodsCat = cat.productos
          return (
            <div key={cat.id} className="rounded-2xl bg-white shadow-card overflow-hidden">
              {/* Header categoría */}
              <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  {cat.nombre}
                </p>
              </div>

              {/* Productos */}
              <div className="divide-y divide-[#F2F2F7]">
                {prodsCat.map((prod) => {
                  const disp = disponibilidad[prod.id] ?? prod.disponible
                  return (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {prod.emoji && (
                          <span className="text-[20px] leading-none flex-shrink-0">
                            {prod.emoji}
                          </span>
                        )}
                        <p
                          className={`text-[14px] font-medium leading-snug truncate ${
                            !disp ? 'text-text-4 line-through' : ''
                          }`}
                        >
                          {prod.nombre}
                        </p>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(prod.id)}
                        className={`relative flex-shrink-0 h-[28px] w-[50px] rounded-full transition-colors duration-200 ${
                          disp ? 'bg-blue-600' : 'bg-[#D1D1D6]'
                        }`}
                        aria-label={disp ? 'Marcar no disponible' : 'Marcar disponible'}
                      >
                        <span
                          className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-200 ${
                            disp ? 'translate-x-[23px]' : 'translate-x-[3px]'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="h-2" />
      </div>
    </div>
  )
}
