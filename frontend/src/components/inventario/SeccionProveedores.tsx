'use client'

import { useState, useTransition } from 'react'
import { crearProveedor, actualizarProveedor, eliminarProveedor } from '@/app/(app)/mas/inventario/actions'
import type { ProveedorInventario } from '@/app/(app)/mas/inventario/page'

interface SeccionProveedoresProps {
  proveedores: ProveedorInventario[]
}

export function SeccionProveedores({ proveedores: initial }: SeccionProveedoresProps) {
  const [proveedores, setProveedores] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  type SheetMode = { tipo: 'none' } | { tipo: 'nuevo' } | { tipo: 'editar'; prov: ProveedorInventario }
  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })
  const [formError, setFormError] = useState<string | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formTelefono, setFormTelefono] = useState('')
  const [formContacto, setFormContacto] = useState('')
  const [formNotas, setFormNotas] = useState('')

  function abrirSheet(mode: SheetMode) {
    setFormError(null)
    if (mode.tipo === 'editar') {
      setFormNombre(mode.prov.nombre)
      setFormTelefono(mode.prov.telefono ?? '')
      setFormContacto(mode.prov.contacto ?? '')
      setFormNotas(mode.prov.notas ?? '')
    } else {
      setFormNombre('')
      setFormTelefono('')
      setFormContacto('')
      setFormNotas('')
    }
    setSheet(mode)
  }

  function handleGuardar() {
    if (!formNombre.trim()) { setFormError('Ingresa un nombre.'); return }
    setFormError(null)

    const payload = {
      nombre: formNombre.trim(),
      telefono: formTelefono.trim() || null,
      contacto: formContacto.trim() || null,
      notas: formNotas.trim() || null,
    }

    if (sheet.tipo === 'nuevo') {
      startTransition(async () => {
        const result = await crearProveedor(payload)
        if ('error' in result) { setFormError(result.error); return }
        setProveedores((prev) => [
          ...prev,
          { id: result.id, ...payload, activo: true },
        ].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'editar') {
      const provId = sheet.prov.id
      startTransition(async () => {
        const result = await actualizarProveedor(provId, payload)
        if (result?.error) { setFormError(result.error); return }
        setProveedores((prev) =>
          prev.map((p) => p.id === provId ? { ...p, ...payload } : p)
        )
        setSheet({ tipo: 'none' })
      })
    }
  }

  function handleEliminar(id: number) {
    setError(null)
    startTransition(async () => {
      const result = await eliminarProveedor(id)
      if (result?.error) { setError(result.error); return }
      setProveedores((prev) => prev.filter((p) => p.id !== id))
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

      {proveedores.length > 0 ? (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="divide-y divide-[#F2F2F7]">
            {proveedores.map((prov) => (
              <div key={prov.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{prov.nombre}</p>
                  {(prov.telefono || prov.contacto) && (
                    <p className="mt-0.5 truncate text-xs text-text-3">
                      {[prov.contacto, prov.telefono].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => abrirSheet({ tipo: 'editar', prov })}
                  className="flex-shrink-0 text-[12px] font-medium text-[#173F2E] active:opacity-60"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleEliminar(prov.id)}
                  disabled={isPending}
                  className="flex-shrink-0 text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card px-4 py-10 text-center">
          <p className="text-sm text-text-3">Sin proveedores configurados.</p>
        </div>
      )}

      <button
        onClick={() => abrirSheet({ tipo: 'nuevo' })}
        className="w-full rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-sm font-semibold text-text-3 active:bg-s2"
      >
        + Nuevo proveedor
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
            {sheet.tipo === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'}
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
              placeholder="Ej: Carnicería El Buen Corte"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Teléfono (opcional)
            </label>
            <input
              type="tel"
              value={formTelefono}
              onChange={(e) => setFormTelefono(e.target.value)}
              placeholder="Ej: 33 1234 5678"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Contacto (opcional)
            </label>
            <input
              type="text"
              value={formContacto}
              onChange={(e) => setFormContacto(e.target.value)}
              placeholder="Ej: Nombre de la persona con quien se trata"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Notas (opcional)
            </label>
            <textarea
              value={formNotas}
              onChange={(e) => setFormNotas(e.target.value)}
              rows={3}
              placeholder="Ej: Entrega los martes y viernes"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white resize-none"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
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
