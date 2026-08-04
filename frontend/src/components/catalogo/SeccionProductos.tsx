'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  toggleDisponible,
  subirImagenProducto,
  crearGrupoModificador,
  actualizarGrupoModificador,
  eliminarGrupoModificador,
  guardarGrupoPadres,
  crearOpcion,
  actualizarOpcion,
  eliminarOpcion,
  reordenarProductos,
  reordenarOpciones,
} from '@/app/(app)/mas/catalogo/actions'
import { cargarModificadores } from '@/app/(app)/pos/[pedidoId]/actions'
import { SeccionReceta } from './SeccionReceta'
import { ListaArrastrable } from './ListaArrastrable'
import type { ProductoCatalogo, CategoriaCatalogo, IngredienteCatalogo, InsumoCatalogo } from '@/app/(app)/mas/catalogo/page'
import type { ModoOrden, ModoOrdenModificadores } from '@/lib/ordenCatalogo'
import { construirDescripcionNatural } from '@/lib/descripcionNatural'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type OpcionLocal = {
  id: number
  nombre: string
  precio_extra: number
  activa: boolean
  insumo_id: number | null
  horario_desde: string | null
  horario_hasta: string | null
}

type GrupoLocal = {
  id: number
  nombre: string
  requerido: boolean
  minimo: number
  maximo: number
  mostrar_en_rapido: boolean
  opciones: OpcionLocal[]
  // Opciones (de otros grupos ya guardados de este producto) que activan
  // este grupo condicional. Vacío = grupo siempre visible.
  opciones_padre: number[]
  // Formato 'texto_natural' del ticket (ver lib/descripcionNatural.ts).
  conector: string | null
  prefijo_seleccion_unica: string | null
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface SeccionProductosProps {
  productos: ProductoCatalogo[]
  categorias: CategoriaCatalogo[]
  ingredientes: IngredienteCatalogo[]
  insumos: InsumoCatalogo[]
  // Deep-link desde Inventario → Recetas: abre directo el editor de este producto.
  editarProductoId?: number | null
  modoOrdenProductos: ModoOrden
  modoOrdenModificadores: ModoOrdenModificadores
}

export function SeccionProductos({
  productos: initial,
  categorias,
  ingredientes,
  insumos,
  editarProductoId = null,
  modoOrdenProductos,
  modoOrdenModificadores,
}: SeccionProductosProps) {
  const router = useRouter()
  const [productos, setProductos] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [filtroCat, setFiltroCat] = useState<number | null>(null)

  // Sheet
  type SheetMode =
    | { tipo: 'none' }
    | { tipo: 'nuevo' }
    | { tipo: 'editar'; prod: ProductoCatalogo }

  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })

  // Form producto
  const [formNombre, setFormNombre] = useState('')
  const [formPrecio, setFormPrecio] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formEmoji, setFormEmoji] = useState('')
  const [formCat, setFormCat] = useState<number>(categorias[0]?.id ?? 0)
  const [formModo, setFormModo] = useState<'estandar' | 'rapido'>('estandar')
  const [formEsCombo, setFormEsCombo] = useState(false)
  // Disponibilidad automática por horario (F9-04) — '' = sin restricción
  const [formHorarioDesde, setFormHorarioDesde] = useState('')
  const [formHorarioHasta, setFormHorarioHasta] = useState('')

  // Imagen
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string | null>(null)
  const [existingFotoUrl, setExistingFotoUrl] = useState<string | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)

  // ── Estado Modificadores ───────────────────────────────────────────────────
  const [grupos, setGrupos] = useState<GrupoLocal[]>([])
  const [loadingGrupos, setLoadingGrupos] = useState(false)
  const [grupoError, setGrupoError] = useState<string | null>(null)
  const [, startGrupoTransition] = useTransition()

  // Form grupo (nuevo o editar — grupoEditandoId null = creando)
  const [showFormGrupo, setShowFormGrupo] = useState(false)
  const [grupoEditandoId, setGrupoEditandoId] = useState<number | null>(null)
  const [fgNombre, setFgNombre] = useState('')
  const [fgRequerido, setFgRequerido] = useState(false)
  const [fgMin, setFgMin] = useState('1')
  const [fgMax, setFgMax] = useState('1')
  const [fgRapido, setFgRapido] = useState(false)
  const [fgOpcionesPadre, setFgOpcionesPadre] = useState<number[]>([])
  // Formato 'texto_natural' del ticket (ver lib/descripcionNatural.ts)
  const [fgConector, setFgConector] = useState('')
  const [fgPrefijoUnica, setFgPrefijoUnica] = useState('')

  // Form nueva opción (qué grupoId tiene el form abierto)
  const [opFormId, setOpFormId] = useState<number | null>(null)
  const [opEditandoId, setOpEditandoId] = useState<number | null>(null)
  const [foNombre, setFoNombre] = useState('')
  const [foPrecio, setFoPrecio] = useState('')
  const [foInsumoId, setFoInsumoId] = useState<number | null>(null)
  // Disponibilidad automática por horario (F9-04) — '' = sin restricción
  const [foHorarioDesde, setFoHorarioDesde] = useState('')
  const [foHorarioHasta, setFoHorarioHasta] = useState('')

  // ── Abrir / cerrar sheet ───────────────────────────────────────────────────

  function abrirSheet(mode: SheetMode) {
    setError(null)
    setImgFile(null)
    setImgPreview(null)
    setGrupos([])
    setGrupoError(null)
    setShowFormGrupo(false)
    setGrupoEditandoId(null)
    setOpFormId(null)
    setOpEditandoId(null)

    if (mode.tipo === 'editar') {
      setFormNombre(mode.prod.nombre)
      setFormPrecio(mode.prod.precio.toString())
      setFormDesc(mode.prod.descripcion ?? '')
      setFormEmoji(mode.prod.emoji ?? '')
      setFormCat(mode.prod.categoria_id)
      setFormModo(mode.prod.modo_captura)
      setFormEsCombo(mode.prod.es_combo)
      setFormHorarioDesde(mode.prod.horario_desde?.slice(0, 5) ?? '')
      setFormHorarioHasta(mode.prod.horario_hasta?.slice(0, 5) ?? '')
      setExistingFotoUrl(mode.prod.foto_url ?? null)
      setImgPreview(mode.prod.foto_url ?? null)

      // Cargar grupos del producto — soloDisponiblesAhora: false para que el
      // editor muestre también opciones fuera de su horario (F9-04), en vez
      // de esconderlas como hace la vista de POS.
      setLoadingGrupos(true)
      cargarModificadores(mode.prod.id, { soloDisponiblesAhora: false }).then((result) => {
        if ('error' in result) { setLoadingGrupos(false); return }
        setGrupos(
          result.grupos.map((g) => ({
            id: g.id,
            nombre: g.nombre,
            requerido: g.requerido,
            minimo: g.minimo,
            maximo: g.maximo,
            mostrar_en_rapido: g.mostrar_en_rapido,
            opciones: g.opciones,
            opciones_padre: g.opciones_padre,
            conector: g.conector,
            prefijo_seleccion_unica: g.prefijo_seleccion_unica,
          })),
        )
        setLoadingGrupos(false)
      })
    } else {
      setFormNombre('')
      setFormPrecio('')
      setFormDesc('')
      setFormEmoji('')
      setFormCat(filtroCat ?? categorias[0]?.id ?? 0)
      setFormModo('estandar')
      setFormEsCombo(false)
      setFormHorarioDesde('')
      setFormHorarioHasta('')
      setExistingFotoUrl(null)
      setLoadingGrupos(false)
    }

    setSheet(mode)
  }

  // Deep-link desde Inventario → Recetas: abre el editor de ese producto al
  // montar (una sola vez por id, no en cada render).
  useEffect(() => {
    if (editarProductoId == null) return
    const prod = productos.find((p) => p.id === editarProductoId)
    if (prod) abrirSheet({ tipo: 'editar', prod })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarProductoId])

  // ── Handlers producto ──────────────────────────────────────────────────────

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImgFile(file)
    if (file) {
      setImgPreview(URL.createObjectURL(file))
    } else {
      setImgPreview(existingFotoUrl)
    }
  }

  function handleGuardar() {
    if (!formNombre.trim()) { setError('Ingresa un nombre.'); return }
    const precio = parseFloat(formPrecio)
    if (isNaN(precio) || precio < 0) { setError('Precio inválido.'); return }
    if (!!formHorarioDesde !== !!formHorarioHasta) {
      setError('Para restringir por horario, define tanto "desde" como "hasta".')
      return
    }
    setError(null)
    const horarioDesde = formHorarioDesde || null
    const horarioHasta = formHorarioHasta || null

    if (sheet.tipo === 'nuevo') {
      startTransition(async () => {
        let fotoUrl: string | null = null
        if (imgFile) {
          const fd = new FormData()
          fd.append('file', imgFile)
          const uploaded = await subirImagenProducto(fd)
          if ('error' in uploaded) { setError(uploaded.error); return }
          fotoUrl = uploaded.url
        }
        const result = await crearProducto({
          nombre: formNombre.trim(),
          precio,
          categoriaId: formCat,
          descripcion: formDesc.trim() || null,
          emoji: formEmoji.trim() || null,
          foto_url: fotoUrl,
          modo_captura: formModo,
          es_combo: formEsCombo,
          horario_desde: horarioDesde,
          horario_hasta: horarioHasta,
        })
        if ('error' in result) { setError(result.error); return }
        router.refresh()
        setSheet({ tipo: 'none' })
      })
    } else if (sheet.tipo === 'editar') {
      const prodId = sheet.prod.id
      startTransition(async () => {
        let fotoUrl: string | null = existingFotoUrl
        if (imgFile) {
          const fd = new FormData()
          fd.append('file', imgFile)
          const uploaded = await subirImagenProducto(fd)
          if ('error' in uploaded) { setError(uploaded.error); return }
          fotoUrl = uploaded.url
        }
        const result = await actualizarProducto(prodId, {
          nombre: formNombre.trim(),
          precio,
          descripcion: formDesc.trim() || null,
          emoji: formEmoji.trim() || null,
          foto_url: fotoUrl,
          categoria_id: formCat,
          modo_captura: formModo,
          es_combo: formEsCombo,
          horario_desde: horarioDesde,
          horario_hasta: horarioHasta,
        })
        if (result?.error) { setError(result.error); return }
        const catNombre = categorias.find((c) => c.id === formCat)?.nombre ?? ''
        setProductos((prev) =>
          prev.map((p) =>
            p.id === prodId
              ? {
                  ...p,
                  nombre: formNombre.trim(),
                  precio,
                  descripcion: formDesc.trim() || null,
                  emoji: formEmoji.trim() || null,
                  foto_url: fotoUrl,
                  categoria_id: formCat,
                  categoria_nombre: catNombre,
                  modo_captura: formModo,
                  es_combo: formEsCombo,
                  horario_desde: horarioDesde,
                  horario_hasta: horarioHasta,
                }
              : p,
          ),
        )
        setSheet({ tipo: 'none' })
      })
    }
  }

  function handleToggleDisponible(id: number, actual: boolean) {
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, disponible: !actual } : p)),
    )
    startTransition(async () => {
      const result = await toggleDisponible(id, !actual)
      if (result?.error) {
        setProductos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, disponible: actual } : p)),
        )
        setError(result.error)
      }
    })
  }

  function handleEliminar(id: number) {
    startTransition(async () => {
      const result = await eliminarProducto(id)
      if (result?.error) { setError(result.error); return }
      setProductos((prev) => prev.filter((p) => p.id !== id))
    })
  }

  // Arrastre solo tiene sentido dentro de una categoría a la vez (el orden es
  // por categoría) y solo persiste algo visible en modo 'personalizado'.
  function handleReordenarProductos(nuevoOrden: ProductoCatalogo[]) {
    if (filtroCat === null) return
    setProductos((prev) => {
      let idx = 0
      return prev.map((p) => (p.categoria_id === filtroCat ? nuevoOrden[idx++] : p))
    })
    startTransition(async () => {
      const result = await reordenarProductos(nuevoOrden.map((p) => p.id))
      if (result?.error) setError(result.error)
    })
  }

  // ── Handlers modificadores ─────────────────────────────────────────────────

  function resetFormGrupo() {
    setFgNombre('')
    setFgRequerido(false)
    setFgMin('1')
    setFgMax('1')
    setFgRapido(false)
    setFgOpcionesPadre([])
    setFgConector('')
    setFgPrefijoUnica('')
    setGrupoEditandoId(null)
    setShowFormGrupo(false)
  }

  function abrirFormGrupo(grupo?: GrupoLocal) {
    setGrupoError(null)
    if (grupo) {
      setGrupoEditandoId(grupo.id)
      setFgNombre(grupo.nombre)
      setFgRequerido(grupo.requerido)
      setFgMin(grupo.minimo.toString())
      setFgMax(grupo.maximo.toString())
      setFgRapido(grupo.mostrar_en_rapido)
      setFgOpcionesPadre(grupo.opciones_padre)
      setFgConector(grupo.conector ?? '')
      setFgPrefijoUnica(grupo.prefijo_seleccion_unica ?? '')
    } else {
      setGrupoEditandoId(null)
      setFgNombre('')
      setFgRequerido(false)
      setFgMin('1')
      setFgMax('1')
      setFgRapido(false)
      setFgOpcionesPadre([])
      setFgConector('')
      setFgPrefijoUnica('')
    }
    setShowFormGrupo(true)
  }

  function handleGuardarGrupo() {
    if (!fgNombre.trim() || sheet.tipo !== 'editar') return
    const minimo = fgRequerido ? (parseInt(fgMin) || 1) : 0
    const maximo = parseInt(fgMax) || 1

    if (grupoEditandoId !== null) {
      const grupoId = grupoEditandoId
      startGrupoTransition(async () => {
        const result = await actualizarGrupoModificador(grupoId, {
          nombre: fgNombre.trim(),
          requerido: fgRequerido,
          minimo,
          maximo,
          mostrar_en_rapido: fgRapido,
          conector: fgConector.trim() || null,
          prefijo_seleccion_unica: fgPrefijoUnica.trim() || null,
        })
        if (result?.error) { setGrupoError(result.error); return }

        // A diferencia de crear (donde un grupo nuevo nunca tiene padres que
        // limpiar), aquí SIEMPRE se llama — así, si el usuario quitó todos
        // los checks, guardarGrupoPadres borra los que ya existían en vez
        // de dejarlos como estaban.
        let opcionesPadreGuardadas = fgOpcionesPadre
        const padresResult = await guardarGrupoPadres(grupoId, fgOpcionesPadre)
        if (padresResult?.error) {
          setGrupoError(padresResult.error)
          opcionesPadreGuardadas = grupos.find((g) => g.id === grupoId)?.opciones_padre ?? []
        }

        setGrupos((prev) =>
          prev.map((g) =>
            g.id === grupoId
              ? {
                  ...g,
                  nombre: fgNombre.trim(),
                  requerido: fgRequerido,
                  minimo,
                  maximo,
                  mostrar_en_rapido: fgRapido,
                  opciones_padre: opcionesPadreGuardadas,
                  conector: fgConector.trim() || null,
                  prefijo_seleccion_unica: fgPrefijoUnica.trim() || null,
                }
              : g,
          ),
        )
        resetFormGrupo()
      })
      return
    }

    const prodId = sheet.prod.id
    startGrupoTransition(async () => {
      const result = await crearGrupoModificador({
        productoId: prodId,
        nombre: fgNombre.trim(),
        requerido: fgRequerido,
        minimo,
        maximo,
        mostrar_en_rapido: fgRapido,
        conector: fgConector.trim() || null,
        prefijo_seleccion_unica: fgPrefijoUnica.trim() || null,
      })
      if ('error' in result) { setGrupoError(result.error); return }

      let opcionesPadreGuardadas = fgOpcionesPadre
      if (fgOpcionesPadre.length > 0) {
        const padresResult = await guardarGrupoPadres(result.id, fgOpcionesPadre)
        if (padresResult?.error) {
          // El grupo sí se creó — se avisa pero no se pierde, queda sin condición.
          setGrupoError(padresResult.error)
          opcionesPadreGuardadas = []
        }
      }

      setGrupos((prev) => [
        ...prev,
        {
          id: result.id,
          nombre: fgNombre.trim(),
          requerido: fgRequerido,
          minimo,
          maximo,
          mostrar_en_rapido: fgRapido,
          opciones: [],
          opciones_padre: opcionesPadreGuardadas,
          conector: fgConector.trim() || null,
          prefijo_seleccion_unica: fgPrefijoUnica.trim() || null,
        },
      ])
      resetFormGrupo()
    })
  }

  function toggleFgOpcionPadre(opcionId: number) {
    setFgOpcionesPadre((prev) =>
      prev.includes(opcionId) ? prev.filter((id) => id !== opcionId) : [...prev, opcionId],
    )
  }

  // Nombres de opciones (de cualquier grupo del producto) a partir de sus ids
  // — para el resumen "Se activa si eligen: X, Y" y la lista del selector.
  function nombresOpciones(ids: number[]): string[] {
    const todas = grupos.flatMap((g) => g.opciones)
    return ids.map((id) => todas.find((o) => o.id === id)?.nombre).filter((n): n is string => !!n)
  }

  function handleEliminarGrupo(grupoId: number) {
    startGrupoTransition(async () => {
      const result = await eliminarGrupoModificador(grupoId)
      if (result?.error) { setGrupoError(result.error); return }
      setGrupos((prev) => prev.filter((g) => g.id !== grupoId))
      if (opFormId === grupoId) setOpFormId(null)
    })
  }

  function abrirOpcionForm(grupoId: number) {
    setOpFormId(grupoId)
    setOpEditandoId(null)
    setFoNombre('')
    setFoPrecio('')
    setFoInsumoId(null)
    setFoHorarioDesde('')
    setFoHorarioHasta('')
    setGrupoError(null)
  }

  function abrirEditarOpcion(grupoId: number, opcion: OpcionLocal) {
    setOpFormId(grupoId)
    setOpEditandoId(opcion.id)
    setFoNombre(opcion.nombre)
    setFoPrecio(opcion.precio_extra ? opcion.precio_extra.toString() : '')
    setFoInsumoId(null)
    setFoHorarioDesde(opcion.horario_desde?.slice(0, 5) ?? '')
    setFoHorarioHasta(opcion.horario_hasta?.slice(0, 5) ?? '')
    setGrupoError(null)
  }

  function handleGuardarOpcion(grupoId: number) {
    if (!foNombre.trim()) return
    if (!!foHorarioDesde !== !!foHorarioHasta) {
      setGrupoError('Para restringir por horario, define tanto "desde" como "hasta".')
      return
    }
    const horarioDesde = foHorarioDesde || null
    const horarioHasta = foHorarioHasta || null
    if (opEditandoId) {
      const id = opEditandoId
      const nombre = foNombre.trim()
      const precio_extra = parseFloat(foPrecio) || 0
      startGrupoTransition(async () => {
        const result = await actualizarOpcion(id, {
          nombre,
          precio_extra,
          horario_desde: horarioDesde,
          horario_hasta: horarioHasta,
        })
        if (result?.error) { setGrupoError(result.error); return }
        setGrupos((prev) =>
          prev.map((g) =>
            g.id === grupoId
              ? {
                  ...g,
                  opciones: g.opciones.map((o) =>
                    o.id === id
                      ? { ...o, nombre, precio_extra, horario_desde: horarioDesde, horario_hasta: horarioHasta }
                      : o,
                  ),
                }
              : g,
          ),
        )
        setFoNombre('')
        setFoPrecio('')
        setFoInsumoId(null)
        setFoHorarioDesde('')
        setFoHorarioHasta('')
        setOpFormId(null)
        setOpEditandoId(null)
      })
      return
    }
    handleCrearOpcion(grupoId)
  }

  function handleCrearOpcion(grupoId: number) {
    if (!foNombre.trim()) return
    if (!!foHorarioDesde !== !!foHorarioHasta) {
      setGrupoError('Para restringir por horario, define tanto "desde" como "hasta".')
      return
    }
    const horarioDesde = foHorarioDesde || null
    const horarioHasta = foHorarioHasta || null
    startGrupoTransition(async () => {
      const result = await crearOpcion({
        grupoId,
        nombre: foNombre.trim(),
        precio_extra: parseFloat(foPrecio) || 0,
        insumoId: foInsumoId,
        horario_desde: horarioDesde,
        horario_hasta: horarioHasta,
      })
      if ('error' in result) { setGrupoError(result.error); return }
      setGrupos((prev) =>
        prev.map((g) =>
          g.id === grupoId
            ? {
                ...g,
                opciones: [
                  ...g.opciones,
                  {
                    id: result.id,
                    nombre: foNombre.trim(),
                    precio_extra: parseFloat(foPrecio) || 0,
                    activa: true,
                    insumo_id: foInsumoId,
                    horario_desde: horarioDesde,
                    horario_hasta: horarioHasta,
                  },
                ],
              }
            : g,
        ),
      )
      setFoNombre('')
      setFoPrecio('')
      setFoInsumoId(null)
      setFoHorarioDesde('')
      setFoHorarioHasta('')
      setOpFormId(null)
    })
  }

  function handleEliminarOpcion(grupoId: number, opcionId: number) {
    startGrupoTransition(async () => {
      const result = await eliminarOpcion(opcionId)
      if (result?.error) { setGrupoError(result.error); return }
      setGrupos((prev) =>
        prev.map((g) =>
          g.id === grupoId
            ? { ...g, opciones: g.opciones.filter((o) => o.id !== opcionId) }
            : g,
        ),
      )
      if (opEditandoId === opcionId) { setOpFormId(null); setOpEditandoId(null) }
    })
  }

  function handleReordenarOpciones(grupoId: number, nuevoOrden: OpcionLocal[]) {
    setGrupos((prev) =>
      prev.map((g) => {
        if (g.id !== grupoId) return g
        let idx = 0
        return { ...g, opciones: g.opciones.map((o) => (o.activa ? nuevoOrden[idx++] : o)) }
      }),
    )
    startGrupoTransition(async () => {
      const result = await reordenarOpciones(nuevoOrden.map((o) => o.id))
      if (result?.error) setGrupoError(result.error)
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const productosFiltrados = filtroCat
    ? productos.filter((p) => p.categoria_id === filtroCat)
    : productos

  const sheetOpen = sheet.tipo !== 'none'

  function renderFilaProducto(prod: ProductoCatalogo, dragHandleProps?: Record<string, unknown>) {
    return (
      <div key={prod.id} className="flex items-center gap-3 px-4 py-3">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className="flex-shrink-0 cursor-grab touch-none px-0.5 text-[15px] text-text-4 active:cursor-grabbing"
            title="Arrastra para reordenar"
          >
            ⠿
          </span>
        )}
        {prod.foto_url ? (
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-s2">
            <img src={prod.foto_url} alt={prod.nombre} className="h-full w-full object-cover" />
          </div>
        ) : prod.emoji ? (
          <span className="text-[22px] leading-none flex-shrink-0">{prod.emoji}</span>
        ) : null}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{prod.nombre}</p>
          <p className="text-xs text-text-3 mt-0.5">
            ${prod.precio.toFixed(2)} · {prod.categoria_nombre}
          </p>
        </div>
        {/* Toggle disponible */}
        <button
          onClick={() => handleToggleDisponible(prod.id, prod.disponible)}
          disabled={isPending}
          className={`relative flex-shrink-0 h-[24px] w-[42px] rounded-full transition-colors duration-200 disabled:opacity-40 ${
            prod.disponible ? 'bg-green-500' : 'bg-[#D1D1D6]'
          }`}
        >
          <span
            className={`absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
              prod.disponible ? 'translate-x-[20px]' : 'translate-x-[2px]'
            }`}
          />
        </button>
        <button
          onClick={() => abrirSheet({ tipo: 'editar', prod })}
          className="text-[12px] font-medium text-blue-600 active:opacity-60"
        >
          Editar
        </button>
        <button
          onClick={() => handleEliminar(prod.id)}
          disabled={isPending}
          className="text-[12px] font-medium text-red-500 active:opacity-60 disabled:opacity-40"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      {/* Filtro por categoría */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFiltroCat(null)}
          className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
            filtroCat === null ? 'bg-blue-600 text-white' : 'bg-white text-text-2 border border-[#D1D1D6]'
          }`}
        >
          Todos
        </button>
        {categorias.map((c) => (
          <button
            key={c.id}
            onClick={() => setFiltroCat(c.id)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
              filtroCat === c.id ? 'bg-blue-600 text-white' : 'bg-white text-text-2 border border-[#D1D1D6]'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Lista de productos */}
      {filtroCat !== null && modoOrdenProductos !== 'personalizado' && (
        <p className="text-[11px] text-text-4">
          Orden alfabético activo — para reordenar a mano cambia a &quot;Personalizado&quot; en Más → Permisos.
        </p>
      )}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="divide-y divide-[#F2F2F7]">
          {filtroCat !== null && modoOrdenProductos === 'personalizado' ? (
            <ListaArrastrable
              items={productosFiltrados}
              onReorder={handleReordenarProductos}
              renderItem={(prod, dragHandleProps) => renderFilaProducto(prod, dragHandleProps)}
            />
          ) : (
            productosFiltrados.map((prod) => renderFilaProducto(prod))
          )}
          {productosFiltrados.length === 0 && (
            <div className="py-8 text-center text-sm text-text-3">
              Sin productos en esta categoría.
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => abrirSheet({ tipo: 'nuevo' })}
        className="w-full rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-sm font-semibold text-text-3 active:bg-s2"
      >
        + Nuevo producto
      </button>

      {/* ── Sheet ──────────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSheet({ tipo: 'none' })}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[90vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">
            {sheet.tipo === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}
          </h2>
        </div>

        {/* ── Cuerpo scrolleable ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* Nombre + Emoji */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Nombre *
              </label>
              <input
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Taco de bistec"
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="w-16">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Emoji
              </label>
              <input
                type="text"
                value={formEmoji}
                onChange={(e) => setFormEmoji(e.target.value)}
                placeholder="🌮"
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3 py-3 text-center text-lg outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Precio */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Precio *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-text-3">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.50"
                value={formPrecio}
                onChange={(e) => setFormPrecio(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-3 pl-8 pr-3.5 font-mono text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Descripción breve…"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* Imagen */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Imagen (opcional)
            </label>
            <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            {imgPreview ? (
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-s2">
                  <img src={imgPreview} alt="Preview" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => imgInputRef.current?.click()}
                    className="rounded-lg bg-s2 px-3 py-1.5 text-xs font-semibold text-blue-600 active:opacity-60"
                  >
                    Cambiar imagen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImgFile(null)
                      setImgPreview(null)
                      setExistingFotoUrl(null)
                      if (imgInputRef.current) imgInputRef.current.value = ''
                    }}
                    className="rounded-lg bg-s2 px-3 py-1.5 text-xs font-semibold text-red-500 active:opacity-60"
                  >
                    Quitar imagen
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border bg-s2 py-4 text-sm font-semibold text-text-3 active:bg-s3"
              >
                <span className="text-lg">📷</span>
                Seleccionar imagen
              </button>
            )}
          </div>

          {/* Categoría */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Categoría
            </label>
            <select
              value={formCat}
              onChange={(e) => setFormCat(Number(e.target.value))}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Modo de captura */}
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
                    formModo === m ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                  }`}
                >
                  {m === 'estandar' ? 'Estándar' : 'Rápido'}
                </button>
              ))}
            </div>
          </div>

          {/* Es un combo */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[13px] text-text-2">Es un combo</span>
              <p className="text-[11px] text-text-4">
                Se arma con otros productos como componentes, en vez de receta propia
              </p>
            </div>
            <button
              onClick={() => setFormEsCombo((v) => !v)}
              className={`relative ml-3 flex-shrink-0 h-[26px] w-[46px] rounded-full transition-colors duration-200 ${
                formEsCombo ? 'bg-blue-600' : 'bg-[#D1D1D6]'
              }`}
            >
              <span
                className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
                  formEsCombo ? 'translate-x-[22px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          {/* Disponibilidad automática por horario (F9-04) */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Horario de disponibilidad (opcional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={formHorarioDesde}
                onChange={(e) => setFormHorarioDesde(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              />
              <span className="text-text-3">–</span>
              <input
                type="time"
                value={formHorarioHasta}
                onChange={(e) => setFormHorarioHasta(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              />
              {(formHorarioDesde || formHorarioHasta) && (
                <button
                  type="button"
                  onClick={() => { setFormHorarioDesde(''); setFormHorarioHasta('') }}
                  className="flex-shrink-0 text-[12px] font-medium text-red-500 active:opacity-60"
                >
                  Quitar
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-text-4">
              Fuera de este rango el producto se muestra como agotado en el POS, sin importar el
              toggle de disponible. Vacío = sin restricción de horario.
            </p>
          </div>

          {/* ── Modificadores (solo en editar) ──────────────────────────── */}
          {sheet.tipo === 'editar' && (
            <div className="border-t border-[#E5E5EA] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-3">
                  Modificadores
                </label>
                {loadingGrupos && (
                  <span className="text-[11px] text-text-4">Cargando…</span>
                )}
              </div>

              {grupoError && (
                <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {grupoError}
                </div>
              )}

              {/* Sin grupos */}
              {!loadingGrupos && grupos.length === 0 && (
                <p className="mb-3 text-[13px] text-text-4">
                  Sin grupos configurados.
                </p>
              )}

              {/* Lista de grupos */}
              <div className="space-y-3">
                {grupos.map((grupo) => (
                  <div
                    key={grupo.id}
                    className="overflow-hidden rounded-xl border border-[#E5E5EA]"
                  >
                    {/* Cabecera del grupo */}
                    <div className="flex items-start gap-2 bg-s2 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold leading-tight">
                          {grupo.nombre}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-3">
                          {grupo.requerido
                            ? `Requerido · elige ${grupo.minimo}–${grupo.maximo}`
                            : `Opcional · máx. ${grupo.maximo}`}
                          {grupo.mostrar_en_rapido && ' · Modo rápido'}
                        </p>
                        {grupo.opciones_padre.length > 0 && (
                          <p className="mt-0.5 text-[11px] font-medium text-purple-600">
                            Se activa si eligen: {nombresOpciones(grupo.opciones_padre).join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => abrirFormGrupo(grupo)}
                        className="flex-shrink-0 rounded-full p-1 text-blue-600 active:opacity-60"
                        title="Editar grupo"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleEliminarGrupo(grupo.id)}
                        className="flex-shrink-0 rounded-full p-1 text-red-500 active:opacity-60"
                        title="Eliminar grupo"
                      >
                        ×
                      </button>
                    </div>

                    {/* Opciones del grupo */}
                    {(() => {
                      const opcionesActivas = grupo.opciones.filter((o) => o.activa)
                      const renderOpcion = (opcion: OpcionLocal, dragHandleProps?: Record<string, unknown>) => (
                        <div
                          key={opcion.id}
                          className="flex items-center gap-2 border-t border-[#F2F2F7] px-3 py-2"
                        >
                          {dragHandleProps && (
                            <span
                              {...dragHandleProps}
                              className="flex-shrink-0 cursor-grab touch-none text-text-4 active:cursor-grabbing"
                              title="Arrastra para reordenar"
                            >
                              ⠿
                            </span>
                          )}
                          <span className="flex-1 text-[13px]">{opcion.nombre}</span>
                          {opcion.precio_extra > 0 && (
                            <span className="font-mono text-[11px] text-amber-600">
                              +${opcion.precio_extra.toFixed(2)}
                            </span>
                          )}
                          <button
                            onClick={() => abrirEditarOpcion(grupo.id, opcion)}
                            className="text-[12px] text-blue-600 active:opacity-60"
                            title="Editar opción"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleEliminarOpcion(grupo.id, opcion.id)}
                            className="text-[12px] text-red-500 active:opacity-60"
                          >
                            ×
                          </button>
                        </div>
                      )
                      return modoOrdenModificadores === 'personalizado' ? (
                        <ListaArrastrable
                          items={opcionesActivas}
                          onReorder={(nuevoOrden) => handleReordenarOpciones(grupo.id, nuevoOrden)}
                          renderItem={(opcion, dragHandleProps) => renderOpcion(opcion, dragHandleProps)}
                        />
                      ) : (
                        opcionesActivas.map((opcion) => renderOpcion(opcion))
                      )
                    })()}

                    {/* Form o botón nueva opción */}
                    {opFormId === grupo.id ? (
                      <div className="space-y-2 border-t border-[#E5E5EA] px-3 py-2.5">
                        {opEditandoId && (
                          <p className="text-[11px] font-semibold text-blue-600">Editando opción</p>
                        )}
                        {/* Selector de ingrediente (opcional) — solo al crear */}
                        {!opEditandoId && ingredientes.length > 0 && (
                          <select
                            value={foInsumoId ?? ''}
                            onChange={(e) => {
                              const id = e.target.value ? Number(e.target.value) : null
                              setFoInsumoId(id)
                              if (id) {
                                const ing = ingredientes.find((i) => i.id === id)
                                if (ing) setFoNombre(ing.nombre)
                              }
                            }}
                            className="w-full rounded-lg border-[1.5px] border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                          >
                            <option value="">Sin ingrediente</option>
                            {ingredientes.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.nombre}{!ing.disponible ? ' (agotado)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          value={foNombre}
                          onChange={(e) => setFoNombre(e.target.value)}
                          placeholder="Nombre de la opción"
                          className="w-full rounded-lg border-[1.5px] border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                        />
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-3">
                            +$
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.50"
                            value={foPrecio}
                            onChange={(e) => setFoPrecio(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-lg border-[1.5px] border-border bg-white py-2 pl-8 pr-3 font-mono text-[13px] outline-none focus:border-blue-500"
                          />
                        </div>
                        {/* Disponibilidad automática por horario (F9-04) */}
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                            Horario de disponibilidad (opcional)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={foHorarioDesde}
                              onChange={(e) => setFoHorarioDesde(e.target.value)}
                              className="w-full rounded-lg border-[1.5px] border-border bg-white px-2 py-2 text-[13px] outline-none focus:border-blue-500"
                            />
                            <span className="text-text-3">–</span>
                            <input
                              type="time"
                              value={foHorarioHasta}
                              onChange={(e) => setFoHorarioHasta(e.target.value)}
                              className="w-full rounded-lg border-[1.5px] border-border bg-white px-2 py-2 text-[13px] outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGuardarOpcion(grupo.id)}
                            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white active:opacity-80"
                          >
                            {opEditandoId ? 'Guardar' : 'Agregar'}
                          </button>
                          <button
                            onClick={() => {
                              setOpFormId(null)
                              setOpEditandoId(null)
                              setFoHorarioDesde('')
                              setFoHorarioHasta('')
                            }}
                            className="rounded-lg bg-s2 px-3 py-2 text-[13px] font-semibold text-text-3 active:opacity-80"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => abrirOpcionForm(grupo.id)}
                        className="w-full border-t border-[#F2F2F7] px-3 py-2 text-left text-[12px] font-semibold text-blue-600 active:opacity-60"
                      >
                        + Agregar opción
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Form nuevo grupo / editar grupo */}
              {showFormGrupo ? (
                <div className="mt-3 space-y-2.5 rounded-xl border border-[#D1D1D6] p-3">
                  <p className="text-[12px] font-bold text-text-2">
                    {grupoEditandoId !== null ? 'Editar grupo' : 'Nuevo grupo'}
                  </p>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                      Nombre del grupo *
                    </label>
                    <input
                      type="text"
                      value={fgNombre}
                      onChange={(e) => setFgNombre(e.target.value)}
                      placeholder="Ej: Guisado, Salsas, Extras…"
                      className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Formato 'texto_natural' del ticket (/mas/permisos) — ver
                      lib/descripcionNatural.ts. Opcionales: un grupo sin
                      conector se pega directo al nombre del producto, y sin
                      prefijo una sola opción se muestra tal cual. */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                        Conector
                      </label>
                      <input
                        type="text"
                        value={fgConector}
                        onChange={(e) => setFgConector(e.target.value)}
                        placeholder="Ej: con, de, sin…"
                        className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                        Prefijo si se elige solo una
                      </label>
                      <input
                        type="text"
                        value={fgPrefijoUnica}
                        onChange={(e) => setFgPrefijoUnica(e.target.value)}
                        placeholder="Ej: de"
                        className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {(() => {
                    if (sheet.tipo !== 'editar') return null
                    const grupoActual = grupoEditandoId !== null ? grupos.find((g) => g.id === grupoEditandoId) : undefined
                    const opcionesReales = (grupoActual?.opciones ?? [])
                      .filter((o) => o.activa)
                      .map((o) => o.nombre)
                    const maxEjemplo = Math.max(1, Math.min(3, parseInt(fgMax) || 1))
                    const opcionesEjemplo =
                      opcionesReales.length > 0
                        ? opcionesReales.slice(0, maxEjemplo)
                        : maxEjemplo === 1
                          ? ['Pedacito']
                          : ['Libro', 'Pata']
                    const frase = construirDescripcionNatural(sheet.prod.nombre, [
                      {
                        orden: 0,
                        conector: fgConector.trim() || null,
                        prefijoSeleccionUnica: fgPrefijoUnica.trim() || null,
                        opciones: opcionesEjemplo,
                      },
                    ])
                    return (
                      <p className="rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
                        Vista previa: <span className="font-semibold">{frase}</span>
                      </p>
                    )
                  })()}

                  {/* Requerido toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-text-2">Requerido</span>
                    <button
                      onClick={() => setFgRequerido((v) => !v)}
                      className={`relative h-[26px] w-[46px] rounded-full transition-colors duration-200 ${
                        fgRequerido ? 'bg-blue-600' : 'bg-[#D1D1D6]'
                      }`}
                    >
                      <span
                        className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
                          fgRequerido ? 'translate-x-[22px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Mínimo / Máximo */}
                  <div className="flex gap-2">
                    {fgRequerido && (
                      <div className="flex-1">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                          Mínimo
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={fgMin}
                          onChange={(e) => setFgMin(e.target.value)}
                          className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                        Máximo
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={fgMax}
                        onChange={(e) => setFgMax(e.target.value)}
                        className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-3 py-2.5 text-[13px] outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Depende de opciones de otro grupo (condicional) — un
                      grupo no puede depender de sus propias opciones, así
                      que al editar se excluye de la lista de candidatos. */}
                  {grupos.some((g) => g.id !== grupoEditandoId && g.opciones.some((o) => o.activa)) && (
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                        ¿Este grupo depende de alguna opción elegida antes?
                      </label>
                      <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border-[1.5px] border-border bg-s2 p-2">
                        {grupos
                          .filter((g) => g.id !== grupoEditandoId)
                          .map((g) =>
                          g.opciones
                            .filter((o) => o.activa)
                            .map((o) => (
                              <label
                                key={o.id}
                                className="flex items-center gap-2 px-1 py-1 text-[12px]"
                              >
                                <input
                                  type="checkbox"
                                  checked={fgOpcionesPadre.includes(o.id)}
                                  onChange={() => toggleFgOpcionPadre(o.id)}
                                  className="h-4 w-4 rounded border-border"
                                />
                                <span className="text-text-2">
                                  {g.nombre}: {o.nombre}
                                </span>
                              </label>
                            )),
                        )}
                      </div>
                      {fgOpcionesPadre.length > 0 ? (
                        <p className="mt-1 text-[11px] text-purple-600">
                          Se activa si eligen: {nombresOpciones(fgOpcionesPadre).join(', ')}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-text-4">
                          Sin elegir nada, este grupo siempre se muestra.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Modo rápido toggle */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[13px] text-text-2">Modo rápido</span>
                      <p className="text-[11px] text-text-4">
                        Aparece en captura rápida (tacos, guisados)
                      </p>
                    </div>
                    <button
                      onClick={() => setFgRapido((v) => !v)}
                      className={`relative ml-3 flex-shrink-0 h-[26px] w-[46px] rounded-full transition-colors duration-200 ${
                        fgRapido ? 'bg-blue-600' : 'bg-[#D1D1D6]'
                      }`}
                    >
                      <span
                        className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
                          fgRapido ? 'translate-x-[22px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Botones */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleGuardarGrupo}
                      className="flex-[2] rounded-xl bg-blue-600 py-2.5 text-[13px] font-bold text-white active:opacity-80"
                    >
                      {grupoEditandoId !== null ? 'Guardar cambios' : 'Crear grupo'}
                    </button>
                    <button
                      onClick={resetFormGrupo}
                      className="flex-1 rounded-xl bg-s2 py-2.5 text-[13px] font-semibold text-text-3 active:opacity-80"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => abrirFormGrupo()}
                  className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-[#D1D1D6] py-3 text-[13px] font-semibold text-text-3 active:bg-s2"
                >
                  + Agregar grupo
                </button>
              )}
            </div>
          )}

          {/* ── Receta / Componentes de combo (solo en editar) ─────────── */}
          {sheet.tipo === 'editar' && (
            <SeccionReceta
              key={sheet.prod.id}
              producto={sheet.prod}
              productos={productos}
              insumos={insumos}
              grupos={grupos}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* ── Pie fijo: Guardar ──────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={handleGuardar}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>
      </div>
    </div>
  )
}
