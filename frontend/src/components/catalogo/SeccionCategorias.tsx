'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from '@/app/(app)/mas/catalogo/actions'
import type { CategoriaCatalogo } from '@/app/(app)/mas/catalogo/page'

interface SeccionCategoriasProps {
  categorias: CategoriaCatalogo[]
}

export function SeccionCategorias({ categorias: initial }: SeccionCategoriasProps) {
  const router = useRouter()
  const [categorias, setCategorias] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  type SheetMode =
    | { tipo: 'none' }
    | { tipo: 'nueva' }
    | { tipo: 'editar'; cat: CategoriaCatalogo }

  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })
  const [formNombre, setFormNombre] = useState('')
  const [formOrden, setFormOrden] = useState('')
  const [formModo, setFormModo] = useState<'estandar' | 'rapido'>('estandar')

  function abrirSheet(mode: SheetMode) {
    setError(null)
    if (mode.tipo === 'editar') {
      setFormNombre(mode.cat.nombre)
      setFormOrden(mode.cat.orden.toString())
      setFormModo(mode.cat.modo_captura)
    } else {
      setFormNombre('')
      setFormOrden('')
      setFormModo('estandar')
    }
    setSheet(mode)
  }

  function handleGuardar() {
    if (!formNombre.trim()) { setError('Ingresa un nombre.'); return }
    setError(null)

    if (sheet.tipo === 'nueva') {
      startTransition(async () => {
        const result = await crearCategoria({
          nombre: formNombre.trim(),
          orden: formOrden ? parseInt(formOrden) : 99,
          modo_captura: formModo,
        })
        if ('error' in result) { setError(result.error); return }
        router.refresh()
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'editar') {
      const catId = sheet.cat.id
      startTransition(async () => {
        const result = await actualizarCategoria(catId, {
          nombre: formNombre.trim(),
          orden: formOrden ? parseInt(formOrden) : sheet.cat.orden,
          modo_captura: formModo,
        })
        if (result?.error) { setError(result.error); return }
        setCategorias((prev) =>
          prev.map((c) =>
            c.id === catId
              ? { ...c, nombre: formNombre.trim(), orden: parseInt(formOrden) || c.orden, modo_captura: formModo }
              : c,
          ),
        )
        setSheet({ tipo: 'none' })
      })
    }
  }

  function handleEliminar(id: number) {
    startTransition(async () => {
      const result = await eliminarCategoria(id)
      if (result?.error) { setError(result.error); return }
      setCategorias((prev) => prev.filter((c) => c.id !== id))
    })
  }

  const sheetOpen = sheet.tipo !== 'none'

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="divide-y divide-[#F2F2F7]">
          {categorias.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">{cat.nombre}</p>
                <p className="text-xs text-text-3 mt-0.5">
                  Orden: {cat.orden} · {cat.modo_captura === 'rapido' ? 'Modo rápido' : 'Estándar'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => abrirSheet({ tipo: 'editar', cat })}
                  className="text-[12px] font-medium text-blue-600 active:opacity-60"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleEliminar(cat.id)}
                  disabled={isPending}
                  className="text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => abrirSheet({ tipo: 'nueva' })}
        className="w-full rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-sm font-semibold text-text-3 active:bg-s2"
      >
        + Nueva categoría
      </button>

      {/* Sheet */}
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
            {sheet.tipo === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
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
              placeholder="Ej: Tacos, Bebidas…"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Orden (menor = primero)
            </label>
            <input
              type="number"
              value={formOrden}
              onChange={(e) => setFormOrden(e.target.value)}
              placeholder="Ej: 1"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Modo de captura
            </label>
            <div className="flex gap-2">
              {(['estandar', 'rapido'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFormModo(m)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    formModo === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-s2 text-text-2'
                  }`}
                >
                  {m === 'estandar' ? 'Estándar' : 'Rápido'}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={handleGuardar}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
