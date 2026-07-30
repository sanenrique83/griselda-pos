'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VistaMenu } from './VistaMenu'
import { VistaComanda } from './VistaComanda'
import { SheetModificadores, type ConfirmarModPayload } from './SheetModificadores'
import { SheetCapturaPida, type ConfirmarRapidoPayload } from './SheetCapturaPida'
import { SheetUnirMesa, type MesaOcupada } from './SheetUnirMesa'
import { SheetProductoLibre } from './SheetProductoLibre'
import { agregarProducto, agregarProductoRapido, agregarProductoLibre, compartirMesa, agregarComensal } from '@/app/(app)/pos/[pedidoId]/actions'
import type {
  SubpedidoPOS,
  ProductoCatalogo,
  CategoriaPOS,
  MesaSillas,
} from '@/app/(app)/pos/[pedidoId]/page'

interface PosShellProps {
  pedidoId: number | null
  mesaId?: number
  turnoId?: number
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
}

export function PosShell({
  pedidoId,
  mesaId,
  turnoId,
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

  function handleAgregarProducto(producto: ProductoCatalogo) {
    setSheetProducto(producto)
  }

  function handleSheetSuccess() {
    router.refresh()
  }

  // ── Handlers para confirmar producto ──────────────────────────────────────
  async function handleConfirmarMod(payload: ConfirmarModPayload): Promise<{ error?: string }> {
    if (pedidoId !== null) {
      // Modo normal: pedido existente
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
    } else {
      // Modo draft: crear pedido + agregar producto
      if (!mesaId || !turnoId) return { error: 'Sin datos de mesa o turno.' }
      const { crearPedidoYAgregarProducto } = await import('@/app/(app)/pos/nueva/[mesaId]/actions')
      const result = await crearPedidoYAgregarProducto({
        mesaId,
        turnoId,
        productoId: payload.productoId,
        precioUnit: payload.precioUnit,
        cantidad: payload.cantidad,
        notas: payload.notas,
        opciones: payload.opciones,
      })
      if ('error' in result) return { error: result.error }
      router.push(`/pos/${result.pedidoId}`)
      return {}
    }
  }

  async function handleConfirmarRapido(payload: ConfirmarRapidoPayload): Promise<{ error?: string }> {
    if (pedidoId !== null) {
      // Modo normal
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
    } else {
      // Modo draft
      if (!mesaId || !turnoId) return { error: 'Sin datos de mesa o turno.' }
      const { crearPedidoYAgregarRapido } = await import('@/app/(app)/pos/nueva/[mesaId]/actions')
      const result = await crearPedidoYAgregarRapido({
        mesaId,
        turnoId,
        productoId: payload.productoId,
        precioUnit: payload.precioUnit,
        guisados: payload.guisados,
      })
      if ('error' in result) return { error: result.error }
      router.push(`/pos/${result.pedidoId}`)
      return {}
    }
  }

  async function handleConfirmarLibre(payload: { nombre: string; precio: number }): Promise<{ error?: string }> {
    if (pedidoId === null) return { error: 'Abre la mesa agregando un producto normal primero.' }
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
    if (!pedidoId || !mesaId) return
    setIsPendingCompartir(true)
    const result = await compartirMesa(pedidoId, mesaId)
    setIsPendingCompartir(false)
    if ('error' in result) {
      setErrorAccion(result.error)
      return
    }
    router.push(`/pos/${result.nuevoPedidoId}`)
  }

  // Acceso directo desde Menú: agrega un comensal y lo activa sin navegar a
  // la vista de Comanda — el mesero sigue en Menú y puede tocar un producto
  // de inmediato, ya asignado al comensal nuevo, sin pasos intermedios.
  async function handleAgregarComensalMenu() {
    if (pedidoId === null) return
    setErrorAccion(null)
    setIsPendingComensalMenu(true)
    const result = await agregarComensal(pedidoId)
    setIsPendingComensalMenu(false)
    if ('error' in result) {
      setErrorAccion(result.error)
      return
    }
    setSubpedidoActivoId(result.nuevoId)
    router.refresh()
  }

  const subpedidoId = subpedidoActivoId || subpedidos[0]?.id || 0
  const isDraft = pedidoId === null

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
            {isDraft ? (
              <p className="text-[11px] text-amber-600 font-medium">
                Mesa libre · agrega un ítem para abrir
              </p>
            ) : (
              <p className="text-[11px] text-text-3">
                {numComensales} comensal{numComensales !== 1 ? 'es' : ''} · desde{' '}
                {horaApertura}
              </p>
            )}
          </div>

          {!isDraft && pedidoId !== null ? (
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
          ) : (
            <div className="w-[64px]" />
          )}
        </div>

        {/* Tabs Menú / Comanda */}
        <div className="flex items-stretch">
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
          {!isDraft && (
            <button
              onClick={handleAgregarComensalMenu}
              disabled={isPendingComensalMenu}
              className="flex-shrink-0 self-center px-3 py-1.5 text-[12px] font-semibold text-blue-600 active:opacity-60 disabled:opacity-40"
            >
              {isPendingComensalMenu ? '…' : '+ Nuevo comensal'}
            </button>
          )}
          <button
            onClick={() => setVista('comanda')}
            disabled={isDraft}
            className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              vista === 'comanda'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-text-3'
            } disabled:opacity-40`}
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
        {vista === 'menu' || isDraft ? (
          <VistaMenu
            categorias={categorias}
            productos={productos}
            totalPedido={totalPedido}
            onVerComanda={() => !isDraft && setVista('comanda')}
            onAgregarProducto={handleAgregarProducto}
            onAgregarLibre={isDraft ? undefined : () => setSheetLibreOpen(true)}
          />
        ) : (
          <VistaComanda
            pedidoId={pedidoId!}
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
          />
        )}
      </div>

      {/* ── Sheets ─────────────────────────────────────────────────────────── */}
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
      {!isDraft && pedidoId !== null && (
        <SheetUnirMesa
          open={sheetUnirOpen}
          pedidoOrigenId={pedidoId}
          mesasOcupadas={mesasOcupadas}
          onClose={() => setSheetUnirOpen(false)}
        />
      )}
      <SheetProductoLibre
        open={sheetLibreOpen}
        onConfirmar={handleConfirmarLibre}
        onClose={() => setSheetLibreOpen(false)}
      />
    </div>
  )
}
