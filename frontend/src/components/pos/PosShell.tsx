'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VistaMenu } from './VistaMenu'
import { VistaComanda } from './VistaComanda'
import { SheetModificadores, type ConfirmarModPayload } from './SheetModificadores'
import { SheetCapturaPida, type ConfirmarRapidoPayload } from './SheetCapturaPida'
import { SheetComboSlots, type ConfirmarComboPayload } from './SheetComboSlots'
import { SheetUnirMesa, type MesaOcupada } from './SheetUnirMesa'
import { SheetProductoLibre } from './SheetProductoLibre'
import {
  agregarProducto,
  agregarProductoRapido,
  agregarProductoLibre,
  compartirMesa,
  agregarComensal,
  asignarSilla,
  cargarComboSlots,
  type ComboSlot,
} from '@/app/(app)/pos/[pedidoId]/actions'
import { siguienteSillaLibre } from '@/lib/asientos'
import type {
  SubpedidoPOS,
  ProductoCatalogo,
  CategoriaPOS,
  MesaSillas,
  MesaCadenaItem,
} from '@/app/(app)/pos/[pedidoId]/page'

interface PosShellProps {
  pedidoId: number
  mesaId?: number
  mesaLabel: string
  numComensales: number
  pedidoCreatedAt: string
  subpedidos: SubpedidoPOS[]
  categorias: CategoriaPOS[]
  productos: ProductoCatalogo[]
  mesasOcupadas?: MesaOcupada[]
  puedesCancelar?: boolean
  puedeAnularPedido?: boolean
  meseroNombre?: string
  rol?: string
  tipoMesa?: 'mesa' | 'llevar' | 'mostrador'
  mesaSillas?: MesaSillas
  mesasCadena?: MesaCadenaItem[] | null
}

export function PosShell({
  pedidoId,
  mesaId,
  mesaLabel,
  numComensales,
  pedidoCreatedAt,
  subpedidos,
  categorias,
  productos,
  mesasOcupadas = [],
  puedesCancelar = false,
  puedeAnularPedido = false,
  meseroNombre = 'Mesero',
  rol = 'mesero',
  tipoMesa = 'mesa',
  mesaSillas = null,
  mesasCadena = null,
}: PosShellProps) {
  const router = useRouter()
  const [vista, setVista] = useState<'menu' | 'comanda'>('menu')
  const [subpedidoActivoId, setSubpedidoActivoId] = useState(
    subpedidos[0]?.id ?? 0,
  )
  // null = todos los sheets cerrados
  const [sheetProducto, setSheetProducto] = useState<ProductoCatalogo | null>(
    null,
  )
  // Combos electivos (F7-04): null mientras no hay ninguno abierto.
  const [sheetCombo, setSheetCombo] = useState<{ producto: ProductoCatalogo; slots: ComboSlot[] } | null>(
    null,
  )
  const [comprobandoComboId, setComprobandoComboId] = useState<number | null>(null)
  const [sheetUnirOpen, setSheetUnirOpen] = useState(false)
  const [sheetLibreOpen, setSheetLibreOpen] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [isPendingCompartir, setIsPendingCompartir] = useState(false)
  const [isPendingComensalMenu, setIsPendingComensalMenu] = useState(false)

  const totalPedido = subpedidos.reduce((s, sp) => s + sp.total, 0)

  const horaApertura = pedidoCreatedAt
    ? new Date(pedidoCreatedAt).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '--:--'

  // Combos electivos (F7-04): si el producto es un combo con slots
  // configurados, se elige una opción por slot ANTES de abrir el flujo
  // normal — SheetComboSlots reemplaza a modificadores/rápido para ese
  // producto. Si no tiene slots (combo fijo o producto normal), o si la
  // consulta falla, se agrega directo como siempre (mismo comportamiento
  // de antes de este cambio).
  async function handleAgregarProducto(producto: ProductoCatalogo) {
    if (comprobandoComboId !== null) return // evita doble-tap mientras se revisa el combo anterior
    if (producto.es_combo) {
      setComprobandoComboId(producto.id)
      const result = await cargarComboSlots(producto.id)
      setComprobandoComboId(null)
      if (!('error' in result) && result.slots.length > 0) {
        setSheetCombo({ producto, slots: result.slots })
        return
      }
    }
    setSheetProducto(producto)
  }

  function handleSheetSuccess() {
    router.refresh()
  }

  // ── Handlers para confirmar producto ──────────────────────────────────────
  async function handleConfirmarMod(payload: ConfirmarModPayload): Promise<{ error?: string }> {
    const subpedidoId = subpedidoActivoId || subpedidos[0]?.id || 0
    const result = await agregarProducto({
      pedidoId,
      subpedidoId,
      productoId: payload.productoId,
      precioUnit: payload.precioUnit,
      cantidad: payload.cantidad,
      notas: payload.notas,
      opciones: payload.opciones,
    })
    if (result?.error) return { error: result.error }
    handleSheetSuccess()
    return {}
  }

  async function handleConfirmarRapido(payload: ConfirmarRapidoPayload): Promise<{ error?: string }> {
    const subpedidoId = subpedidoActivoId || subpedidos[0]?.id || 0
    const result = await agregarProductoRapido({
      pedidoId,
      subpedidoId,
      productoId: payload.productoId,
      precioUnit: payload.precioUnit,
      guisados: payload.guisados,
    })
    if (result?.error) return { error: result.error }
    handleSheetSuccess()
    return {}
  }

  async function handleConfirmarCombo(payload: ConfirmarComboPayload): Promise<{ error?: string }> {
    const subpedidoId = subpedidoActivoId || subpedidos[0]?.id || 0
    const result = await agregarProducto({
      pedidoId,
      subpedidoId,
      productoId: payload.productoId,
      precioUnit: payload.precioUnit,
      cantidad: payload.cantidad,
      notas: payload.notas,
      opciones: [],
      comboSelecciones: payload.comboSelecciones,
    })
    if (result?.error) return { error: result.error }
    handleSheetSuccess()
    return {}
  }

  async function handleConfirmarLibre(payload: { nombre: string; precio: number }): Promise<{ error?: string }> {
    const subpedidoId = subpedidoActivoId || subpedidos[0]?.id || 0
    const result = await agregarProductoLibre({
      pedidoId,
      subpedidoId,
      nombre: payload.nombre,
      precio: payload.precio,
    })
    if (result?.error) return { error: result.error }
    handleSheetSuccess()
    return {}
  }

  async function handleCompartirMesa() {
    if (!mesaId) return
    setIsPendingCompartir(true)
    const result = await compartirMesa(pedidoId, mesaId)
    setIsPendingCompartir(false)
    if ('error' in result) {
      setErrorAccion(result.error)
      return
    }
    router.push(`/pos/${result.nuevoPedidoId}`)
  }

  // Acceso directo desde el footer de Menú ("+ Nuevo comensal"): agrega un
  // comensal y lo activa sin navegar a la vista de Comanda — el mesero sigue
  // en Menú y puede tocar un producto de inmediato, ya asignado al comensal
  // nuevo, sin pasos intermedios.
  //
  // Si la mesa tiene geometría de sillas, se asigna automáticamente la
  // siguiente silla libre en secuencia (1, 2, 3…) — SIN mostrar ningún
  // picker ni pedir confirmación (eso rompería el "sin pasos intermedios").
  // El botón manual "🪑 Sillas" en Comanda sigue disponible para corregir a
  // mano si alguien terminó sentado distinto al orden automático.
  async function handleAgregarComensalMenu() {
    setErrorAccion(null)
    setIsPendingComensalMenu(true)
    const result = await agregarComensal(pedidoId)
    if ('error' in result) {
      setIsPendingComensalMenu(false)
      setErrorAccion(result.error)
      return
    }

    if (mesaSillas) {
      const siguienteSilla = siguienteSillaLibre(subpedidos.map((s) => s.silla_numero))
      const asignarResult = await asignarSilla(result.nuevoId, siguienteSilla)
      if (asignarResult?.error) {
        // No bloqueamos la creación del comensal por esto — queda sin
        // silla y se corrige después con el botón "🪑 Sillas".
        setErrorAccion(asignarResult.error)
      }
    }

    setIsPendingComensalMenu(false)
    setSubpedidoActivoId(result.nuevoId)
    router.refresh()
  }

  return (
    // Ocupa el espacio disponible por encima del BottomNav fijo
    <div
      className="flex flex-col"
      style={{
        height:
          'calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#E5E5EA]">
        {/* Fila principal */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <button
            onClick={() => router.push('/mesas')}
            className="-ml-1 px-1 py-1 text-[15px] font-medium text-blue-600 active:opacity-60"
          >
            ‹ Mesas
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p className="text-[15px] font-semibold leading-tight truncate">
              {mesaLabel}
            </p>
            <p className="text-[11px] text-text-3">
              {numComensales} comensal{numComensales !== 1 ? 'es' : ''} · desde{' '}
              {horaApertura}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {mesasOcupadas.length > 0 && (
              <button
                onClick={() => setSheetUnirOpen(true)}
                className="px-1 py-1 text-[12px] font-medium text-text-3 active:opacity-60"
                title="Unir con otra mesa"
              >
                Unir
              </button>
            )}
            {mesaId && (
              <button
                onClick={handleCompartirMesa}
                disabled={isPendingCompartir}
                className="px-1 py-1 text-[12px] font-medium text-text-3 active:opacity-60 disabled:opacity-40"
                title="Compartir mesa"
              >
                {isPendingCompartir ? '…' : 'Compartir'}
              </button>
            )}
            <button
              onClick={() => router.push(`/cobro/${pedidoId}`)}
              className="px-1 py-1 text-[13px] font-semibold text-green-600 whitespace-nowrap active:opacity-60"
            >
              Cobrar →
            </button>
          </div>
        </div>

        {/* Tabs Menú / Comanda */}
        <div className="flex">
          <button
            onClick={() => setVista('menu')}
            className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              vista === 'menu'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-text-3'
            }`}
          >
            Menú
          </button>
          <button
            onClick={() => setVista('comanda')}
            className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              vista === 'comanda'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-text-3'
            }`}
          >
            Comanda
            {totalPedido > 0 && (
              <span className="ml-1.5 font-mono text-[11px]">
                ${totalPedido.toFixed(2)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Error de acciones del header (compartir / nuevo comensal) ───────── */}
      {errorAccion && (
        <div
          className="flex-shrink-0 bg-red-50 border-b border-red-100 px-4 py-2 text-xs text-red-600 font-medium"
          onClick={() => setErrorAccion(null)}
        >
          {errorAccion} · Toca para cerrar
        </div>
      )}

      {/* ── Vista principal ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {vista === 'menu' ? (
          <VistaMenu
            categorias={categorias}
            productos={productos}
            totalPedido={totalPedido}
            onVerComanda={() => setVista('comanda')}
            onAgregarProducto={handleAgregarProducto}
            onAgregarLibre={() => setSheetLibreOpen(true)}
            onAgregarComensal={handleAgregarComensalMenu}
            isPendingAgregarComensal={isPendingComensalMenu}
          />
        ) : (
          <VistaComanda
            pedidoId={pedidoId}
            subpedidos={subpedidos}
            subpedidoActivoId={subpedidoActivoId}
            onCambiarSubpedido={(id) => setSubpedidoActivoId(id)}
            onAgregar={() => setVista('menu')}
            puedesCancelar={puedesCancelar}
            puedeAnularPedido={puedeAnularPedido}
            mesaId={mesaId ?? null}
            mesaLabel={mesaLabel}
            meseroNombre={meseroNombre}
            rol={rol}
            tipoMesa={tipoMesa}
            mesaSillas={mesaSillas}
            mesasCadena={mesasCadena}
          />
        )}
      </div>

      {/* ── Sheets ─────────────────────────────────────────────────────────── */}
      <SheetComboSlots
        producto={sheetCombo?.producto ?? null}
        slots={sheetCombo?.slots ?? []}
        onConfirmar={handleConfirmarCombo}
        onClose={() => setSheetCombo(null)}
      />
      <SheetCapturaPida
        producto={
          sheetProducto?.modo_captura === 'rapido' ? sheetProducto : null
        }
        onConfirmarRapido={handleConfirmarRapido}
        onClose={() => setSheetProducto(null)}
      />
      <SheetModificadores
        producto={
          sheetProducto?.modo_captura !== 'rapido' ? sheetProducto : null
        }
        onConfirmar={handleConfirmarMod}
        onClose={() => setSheetProducto(null)}
      />
      <SheetUnirMesa
        open={sheetUnirOpen}
        pedidoOrigenId={pedidoId}
        mesasOcupadas={mesasOcupadas}
        onClose={() => setSheetUnirOpen(false)}
      />
      <SheetProductoLibre
        open={sheetLibreOpen}
        onConfirmar={handleConfirmarLibre}
        onClose={() => setSheetLibreOpen(false)}
      />
    </div>
  )
}
