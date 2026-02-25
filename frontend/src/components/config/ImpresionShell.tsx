'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  toggleImpresionGlobal,
  actualizarImpresora,
  actualizarGrupo,
  crearImpresora,
  eliminarImpresora,
  crearGrupo,
  eliminarGrupo,
  asignarCategoriasGrupo,
} from '@/app/(app)/mas/config/actions'
import type {
  ConfigData,
  ImpresoraData,
  GrupoData,
  CategoriaSimple,
} from '@/app/(app)/mas/config/page'

// ─── Definición de los 5 toggles por impresora ────────────────────────────────

type ImpresoraToggleField = keyof Pick<
  ImpresoraData,
  | 'imprimir_recibos_cuentas'
  | 'imprimir_pedidos'
  | 'imprimir_automaticamente'
  | 'un_articulo_por_ticket'
  | 'agrupar_identicos'
>

const TOGGLES_IMPRESORA: {
  campo: ImpresoraToggleField
  label: string
  desc: string
}[] = [
  {
    campo: 'imprimir_recibos_cuentas',
    label: 'Recibos y cuentas',
    desc: 'Genera ticket de cobro al cerrar una cuenta',
  },
  {
    campo: 'imprimir_pedidos',
    label: 'Pedidos a cocina',
    desc: 'Envía comandas a esta impresora',
  },
  {
    campo: 'imprimir_automaticamente',
    label: 'Impresión automática',
    desc: 'Sin confirmación al recibir un pedido',
  },
  {
    campo: 'un_articulo_por_ticket',
    label: 'Un artículo por ticket',
    desc: 'Ticket separado por cada producto',
  },
  {
    campo: 'agrupar_identicos',
    label: 'Agrupar artículos idénticos',
    desc: '"3× Refresco" en vez de tres filas',
  },
]

// ─── Tipos de sheets ─────────────────────────────────────────────────────────

type SheetMode =
  | { tipo: 'none' }
  | { tipo: 'nueva-impresora' }
  | { tipo: 'editar-impresora'; imp: ImpresoraData }
  | { tipo: 'nuevo-grupo' }
  | { tipo: 'editar-grupo'; grupo: GrupoData }

// ─── Componente principal ─────────────────────────────────────────────────────

export function ImpresionShell({ initialData }: { initialData: ConfigData }) {
  const router = useRouter()
  const [data, setData] = useState<ConfigData>(initialData)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Sheet
  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })
  const [formNombre, setFormNombre] = useState('')
  const [formIp, setFormIp] = useState('')
  const [formPuerto, setFormPuerto] = useState('9100')
  const [formAncho, setFormAncho] = useState<'58mm' | '80mm'>('80mm')
  const [formImpresoraId, setFormImpresoraId] = useState(0)
  const [formCatIds, setFormCatIds] = useState<number[]>([])
  const [sheetError, setSheetError] = useState<string | null>(null)

  // Auto-dismiss del error
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 4000)
    return () => clearTimeout(t)
  }, [errorMsg])

  // ── Helpers de estado ────────────────────────────────────────────────────
  function patchImpresora(id: number, patch: Partial<ImpresoraData>) {
    setData((prev) => ({
      ...prev,
      impresoras: prev.impresoras.map((imp) =>
        imp.id === id ? { ...imp, ...patch } : imp,
      ),
    }))
  }

  function patchGrupo(id: number, patch: Partial<GrupoData>) {
    setData((prev) => ({
      ...prev,
      grupos: prev.grupos.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }))
  }

  // ── Handlers con actualización optimista + rollback ──────────────────────
  async function handleGlobal(activa: boolean) {
    setData((prev) => ({ ...prev, impresionGlobal: activa }))
    const r = await toggleImpresionGlobal(activa)
    if (r?.error) {
      setData((prev) => ({ ...prev, impresionGlobal: !activa }))
      setErrorMsg(r.error)
    }
  }

  async function handleImpresora(
    imp: ImpresoraData,
    patch: Parameters<typeof actualizarImpresora>[1],
  ) {
    patchImpresora(imp.id, patch)
    const r = await actualizarImpresora(imp.id, patch)
    if (r?.error) {
      patchImpresora(imp.id, imp) // rollback
      setErrorMsg(r.error)
    }
  }

  async function handleGrupo(
    grupo: GrupoData,
    patch: Parameters<typeof actualizarGrupo>[1],
  ) {
    patchGrupo(grupo.id, patch)
    const r = await actualizarGrupo(grupo.id, patch)
    if (r?.error) {
      patchGrupo(grupo.id, grupo) // rollback
      setErrorMsg(r.error)
    }
  }

  // ── Abrir sheet ──────────────────────────────────────────────────────────
  function abrirSheet(mode: SheetMode) {
    setSheetError(null)
    if (mode.tipo === 'nueva-impresora') {
      setFormNombre('')
      setFormIp('')
      setFormPuerto('9100')
      setFormAncho('80mm')
    } else if (mode.tipo === 'editar-impresora') {
      setFormNombre(mode.imp.nombre)
      setFormIp(mode.imp.ip)
      setFormPuerto(mode.imp.puerto.toString())
      setFormAncho(mode.imp.ancho_papel)
    } else if (mode.tipo === 'nuevo-grupo') {
      setFormNombre('')
      setFormImpresoraId(data.impresoras[0]?.id ?? 0)
      setFormCatIds([])
    } else if (mode.tipo === 'editar-grupo') {
      setFormNombre(mode.grupo.nombre)
      setFormImpresoraId(mode.grupo.impresora_id)
      setFormCatIds(mode.grupo.categorias.map((c) => c.id))
    }
    setSheet(mode)
  }

  function cerrarSheet() {
    setSheet({ tipo: 'none' })
  }

  // ── Guardar sheet ────────────────────────────────────────────────────────
  function handleGuardar() {
    setSheetError(null)
    if (!formNombre.trim()) { setSheetError('Ingresa un nombre.'); return }

    if (sheet.tipo === 'nueva-impresora') {
      if (!formIp.trim()) { setSheetError('Ingresa la IP.'); return }
      const puerto = parseInt(formPuerto)
      if (isNaN(puerto)) { setSheetError('Puerto inválido.'); return }
      startTransition(async () => {
        const result = await crearImpresora({
          nombre: formNombre.trim(),
          ip: formIp.trim(),
          puerto,
          ancho_papel: formAncho,
        })
        if ('error' in result) { setSheetError(result.error); return }
        router.refresh()
        cerrarSheet()
      })

    } else if (sheet.tipo === 'editar-impresora') {
      if (!formIp.trim()) { setSheetError('Ingresa la IP.'); return }
      const puerto = parseInt(formPuerto)
      if (isNaN(puerto)) { setSheetError('Puerto inválido.'); return }
      const impId = sheet.imp.id
      startTransition(async () => {
        const r = await actualizarImpresora(impId, {
          nombre: formNombre.trim(),
          ip: formIp.trim(),
          puerto,
          ancho_papel: formAncho,
        })
        if (r?.error) { setSheetError(r.error); return }
        patchImpresora(impId, {
          nombre: formNombre.trim(),
          ip: formIp.trim(),
          puerto,
          ancho_papel: formAncho,
        })
        cerrarSheet()
      })

    } else if (sheet.tipo === 'nuevo-grupo') {
      if (!formImpresoraId) { setSheetError('Selecciona una impresora.'); return }
      startTransition(async () => {
        const result = await crearGrupo({
          nombre: formNombre.trim(),
          impresora_id: formImpresoraId,
        })
        if ('error' in result) { setSheetError(result.error); return }
        // Assign categories
        if (formCatIds.length > 0) {
          await asignarCategoriasGrupo(result.id, formCatIds)
        }
        router.refresh()
        cerrarSheet()
      })

    } else if (sheet.tipo === 'editar-grupo') {
      const grupoId = sheet.grupo.id
      startTransition(async () => {
        const r = await actualizarGrupo(grupoId, {
          nombre: formNombre.trim(),
          impresora_id: formImpresoraId,
        })
        if (r?.error) { setSheetError(r.error); return }
        const r2 = await asignarCategoriasGrupo(grupoId, formCatIds)
        if (r2?.error) { setSheetError(r2.error); return }
        // Update local state
        const catObjs = data.categorias
          .filter((c) => formCatIds.includes(c.id))
          .map((c) => ({ id: c.id, nombre: c.nombre }))
        patchGrupo(grupoId, {
          nombre: formNombre.trim(),
          impresora_id: formImpresoraId,
          categorias: catObjs,
        })
        // Update local categorias assignment
        setData((prev) => ({
          ...prev,
          categorias: prev.categorias.map((c) => {
            if (formCatIds.includes(c.id)) return { ...c, grupo_impresora_id: grupoId }
            if (c.grupo_impresora_id === grupoId) return { ...c, grupo_impresora_id: null }
            return c
          }),
        }))
        cerrarSheet()
      })
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  function handleEliminarImpresora(id: number) {
    startTransition(async () => {
      const r = await eliminarImpresora(id)
      if (r?.error) { setErrorMsg(r.error); return }
      setData((prev) => ({
        ...prev,
        impresoras: prev.impresoras.filter((imp) => imp.id !== id),
      }))
    })
  }

  function handleEliminarGrupo(id: number) {
    startTransition(async () => {
      const r = await eliminarGrupo(id)
      if (r?.error) { setErrorMsg(r.error); return }
      setData((prev) => ({
        ...prev,
        grupos: prev.grupos.filter((g) => g.id !== id),
        categorias: prev.categorias.map((c) =>
          c.grupo_impresora_id === id ? { ...c, grupo_impresora_id: null } : c,
        ),
      }))
    })
  }

  const sheetOpen = sheet.tipo !== 'none'
  const sheetTitle =
    sheet.tipo === 'nueva-impresora' ? 'Nueva impresora' :
    sheet.tipo === 'editar-impresora' ? 'Editar impresora' :
    sheet.tipo === 'nuevo-grupo' ? 'Nuevo grupo' :
    sheet.tipo === 'editar-grupo' ? 'Editar grupo' : ''

  const isGrupoSheet = sheet.tipo === 'nuevo-grupo' || sheet.tipo === 'editar-grupo'

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-s2">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/mas')}
            className="-ml-1 px-1 py-1 text-[15px] font-medium text-blue-600 active:opacity-60"
          >
            ‹ Más
          </button>
          <h1 className="flex-1 text-center text-[16px] font-semibold">
            Impresoras
          </h1>
          <div className="w-12" />
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      <div className="px-4 py-4 space-y-5">

        {/* ── Sección: Sistema ────────────────────────────────────────────── */}
        <Section title="Sistema">
          <ToggleRow
            label="Impresión activa"
            desc="Desactiva para suspender toda la impresión automática"
            checked={data.impresionGlobal}
            onChange={(v) => handleGlobal(v)}
          />
        </Section>

        {!data.impresionGlobal && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
            <span className="mt-0.5 text-[17px]">⚠️</span>
            <p className="text-xs font-medium text-amber-700">
              La impresión está desactivada globalmente. Los pedidos no se
              enviarán a ninguna impresora.
            </p>
          </div>
        )}

        {/* ── Sección: Dispositivos ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Dispositivos
            </p>
            <button
              onClick={() => abrirSheet({ tipo: 'nueva-impresora' })}
              className="text-[13px] font-semibold text-blue-600 active:opacity-60"
            >
              + Agregar
            </button>
          </div>

          {data.impresoras.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-card px-4 py-6 text-center">
              <p className="text-2xl mb-2">🖨️</p>
              <p className="text-sm text-text-3">No hay impresoras configuradas.</p>
              <p className="mt-1 text-xs text-text-4">
                Toca "+ Agregar" para añadir una impresora de red.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.impresoras.map((imp) => (
                <ImpresoraCard
                  key={imp.id}
                  imp={imp}
                  globalOff={!data.impresionGlobal}
                  isPending={isPending}
                  onToggle={(campo, val) =>
                    handleImpresora(imp, { [campo]: val })
                  }
                  onAnchoPapel={(ancho) =>
                    handleImpresora(imp, { ancho_papel: ancho })
                  }
                  onActiva={(v) => handleImpresora(imp, { activa: v })}
                  onEditar={() => abrirSheet({ tipo: 'editar-impresora', imp })}
                  onEliminar={() => handleEliminarImpresora(imp.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Sección: Grupos lógicos ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Grupos lógicos
            </p>
            <button
              onClick={() => abrirSheet({ tipo: 'nuevo-grupo' })}
              disabled={data.impresoras.length === 0}
              className="text-[13px] font-semibold text-blue-600 active:opacity-60 disabled:opacity-40"
            >
              + Agregar
            </button>
          </div>

          {data.grupos.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-card px-4 py-6 text-center">
              <p className="text-sm text-text-3">No hay grupos lógicos.</p>
              <p className="mt-1 text-xs text-text-4">
                Los grupos enrutan categorías de productos a una impresora específica.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              {data.grupos.map((grupo, idx) => (
                <GrupoRow
                  key={grupo.id}
                  grupo={grupo}
                  impresoras={data.impresoras}
                  isLast={idx === data.grupos.length - 1}
                  globalOff={!data.impresionGlobal}
                  isPending={isPending}
                  onActivo={(v) => handleGrupo(grupo, { activo: v })}
                  onReasignar={(impresoraId) =>
                    handleGrupo(grupo, { impresora_id: impresoraId })
                  }
                  onEditar={() => abrirSheet({ tipo: 'editar-grupo', grupo })}
                  onEliminar={() => handleEliminarGrupo(grupo.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="h-2" />
      </div>

      {/* ── Bottom Sheet ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={cerrarSheet}
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
          {/* Nombre */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Nombre *
            </label>
            <input
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder={isGrupoSheet ? 'Ej: Cocina, Barra…' : 'Ej: Cocina Principal'}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* Campos solo para impresoras */}
          {(sheet.tipo === 'nueva-impresora' || sheet.tipo === 'editar-impresora') && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Dirección IP *
                </label>
                <input
                  type="text"
                  value={formIp}
                  onChange={(e) => setFormIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 font-mono text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Puerto
                </label>
                <input
                  type="number"
                  value={formPuerto}
                  onChange={(e) => setFormPuerto(e.target.value)}
                  placeholder="9100"
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 font-mono text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Ancho del papel
                </label>
                <div className="flex gap-2">
                  {(['58mm', '80mm'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setFormAncho(a)}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                        formAncho === a ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Campos solo para grupos */}
          {isGrupoSheet && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Impresora *
                </label>
                {data.impresoras.length === 0 ? (
                  <p className="text-sm text-red-500">No hay impresoras. Crea una primero.</p>
                ) : (
                  <select
                    value={formImpresoraId}
                    onChange={(e) => setFormImpresoraId(Number(e.target.value))}
                    className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    {data.impresoras.map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {imp.nombre}{!imp.activa ? ' (inactiva)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Categorías */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  Categorías
                </label>
                {data.categorias.length === 0 ? (
                  <p className="text-sm text-text-3">Sin categorías disponibles.</p>
                ) : (
                  <div className="rounded-xl border-[1.5px] border-border bg-s2 divide-y divide-[#F2F2F7]">
                    {data.categorias.map((cat) => {
                      const checked = formCatIds.includes(cat.id)
                      const editId = sheet.tipo === 'editar-grupo' ? sheet.grupo.id : null
                      const occupiedBy = cat.grupo_impresora_id !== null &&
                        cat.grupo_impresora_id !== editId
                        ? data.grupos.find((g) => g.id === cat.grupo_impresora_id)?.nombre
                        : null
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            if (occupiedBy) return
                            setFormCatIds((prev) =>
                              prev.includes(cat.id)
                                ? prev.filter((id) => id !== cat.id)
                                : [...prev, cat.id],
                            )
                          }}
                          className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors active:bg-s3 ${
                            occupiedBy ? 'opacity-40 cursor-default' : ''
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium">{cat.nombre}</p>
                            {occupiedBy && (
                              <p className="text-[11px] text-text-3">En grupo: {occupiedBy}</p>
                            )}
                          </div>
                          {!occupiedBy && (
                            <div
                              className={`h-5 w-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-[#C7C7CC] bg-white'
                              }`}
                            >
                              {checked && (
                                <span className="text-white text-[11px] font-bold leading-none">✓</span>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {sheetError && <p className="text-sm text-red-600">{sheetError}</p>}
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

// ─── Tarjeta de impresora ─────────────────────────────────────────────────────

function ImpresoraCard({
  imp,
  globalOff,
  isPending,
  onToggle,
  onAnchoPapel,
  onActiva,
  onEditar,
  onEliminar,
}: {
  imp: ImpresoraData
  globalOff: boolean
  isPending: boolean
  onToggle: (campo: ImpresoraToggleField, val: boolean) => void
  onAnchoPapel: (ancho: '58mm' | '80mm') => void
  onActiva: (v: boolean) => void
  onEditar: () => void
  onEliminar: () => void
}) {
  const dimmed = globalOff || !imp.activa

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      {/* Cabecera del dispositivo */}
      <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight">
              🖨 {imp.nombre}
            </p>
            <p className="mt-0.5 font-mono text-[12px] text-text-3">
              {imp.ip}:{imp.puerto}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onEditar}
              className="text-[12px] font-medium text-blue-600 active:opacity-60"
            >
              Editar
            </button>
            <button
              onClick={onEliminar}
              disabled={isPending}
              className="text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
            >
              ×
            </button>
            <Toggle checked={imp.activa} onChange={onActiva} />
          </div>
        </div>

        {/* Ancho de papel */}
        <div className="mt-3 flex items-center gap-3">
          <p className="text-xs font-semibold text-text-3">Ancho papel</p>
          <div className="flex overflow-hidden rounded-lg border border-border text-xs font-semibold">
            {(['58mm', '80mm'] as const).map((size) => (
              <button
                key={size}
                onClick={() => {
                  if (imp.ancho_papel !== size) onAnchoPapel(size)
                }}
                className={`px-3 py-1.5 transition-colors active:opacity-70 ${
                  imp.ancho_papel === size
                    ? 'bg-blue-600 text-white'
                    : 'bg-s2 text-text-3'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Los 5 toggles */}
      <div className={`divide-y divide-[#F2F2F7] ${dimmed ? 'opacity-40' : ''}`}>
        {TOGGLES_IMPRESORA.map((t) => (
          <ToggleRow
            key={t.campo}
            label={t.label}
            desc={t.desc}
            checked={imp[t.campo]}
            onChange={(v) => onToggle(t.campo, v)}
            disabled={dimmed}
          />
        ))}
      </div>

      {!imp.activa && !globalOff && (
        <div className="border-t border-[#E5E5EA] px-4 py-2.5">
          <p className="text-[11px] text-text-4">
            Impresora desactivada — los toggles no tienen efecto.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Fila de grupo lógico ─────────────────────────────────────────────────────

function GrupoRow({
  grupo,
  impresoras,
  isLast,
  globalOff,
  isPending,
  onActivo,
  onReasignar,
  onEditar,
  onEliminar,
}: {
  grupo: GrupoData
  impresoras: ImpresoraData[]
  isLast: boolean
  globalOff: boolean
  isPending: boolean
  onActivo: (v: boolean) => void
  onReasignar: (impresoraId: number) => void
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <div className={`${isLast ? '' : 'border-b border-[#F2F2F7]'}`}>
      {/* Fila principal: nombre + activo */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <p className="text-sm font-semibold">{grupo.nombre}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onEditar}
            className="text-[12px] font-medium text-blue-600 active:opacity-60"
          >
            Editar
          </button>
          <button
            onClick={onEliminar}
            disabled={isPending}
            className="text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
          >
            ×
          </button>
          <Toggle
            checked={grupo.activo}
            onChange={(v) => onActivo(v)}
            disabled={globalOff}
          />
        </div>
      </div>

      {/* Selector de impresora */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <p className="text-xs text-text-3 w-20 flex-shrink-0">Impresora</p>
        {impresoras.length === 0 ? (
          <p className="text-xs text-text-4">Sin impresoras</p>
        ) : (
          <select
            value={grupo.impresora_id}
            onChange={(e) => onReasignar(Number(e.target.value))}
            className="flex-1 rounded-lg border border-border bg-s2 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white"
          >
            {impresoras.map((imp) => (
              <option key={imp.id} value={imp.id}>
                {imp.nombre}
                {!imp.activa ? ' (inactiva)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Chips de categorías */}
      <div className="px-4 pb-3.5">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-4">
          Categorías
        </p>
        {grupo.categorias.length === 0 ? (
          <p className="text-xs text-text-4">Sin categorías asignadas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {grupo.categorias.map((cat) => (
              <span
                key={cat.id}
                className="rounded-full bg-s2 px-2.5 py-1 text-[11px] font-medium text-text-2"
              >
                {cat.nombre}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componentes base ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative h-[28px] w-[50px] flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-[#C7C7CC]'
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'active:opacity-80'}`}
    >
      <span
        className={`absolute top-[2px] h-[24px] w-[24px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.22)] transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  desc?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3.5 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{label}</p>
        {desc && (
          <p className="mt-0.5 text-[12px] leading-snug text-text-3">{desc}</p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
