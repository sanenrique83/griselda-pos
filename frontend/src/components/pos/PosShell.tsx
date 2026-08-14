'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, ArrowLeftRight, UserCog, MoreHorizontal, Merge, Split, Users2, Clock3, ArrowRight } from 'lucide-react'
import { VistaMenu } from './VistaMenu'
import { VistaComanda } from './VistaComanda'
import { SheetModificadores, type ConfirmarModPayload } from './SheetModificadores'
import { SheetCapturaPida, type ConfirmarRapidoPayload } from './SheetCapturaPida'
import { SheetComboSlots, type ConfirmarComboPayload } from './SheetComboSlots'
import { SheetUnirMesa, type MesaOcupada } from './SheetUnirMesa'
import { SheetMoverMesa, type MesaLibre } from './SheetMoverMesa'
import { SheetSepararMesa, type MesaSatelite } from './SheetSepararMesa'
import { SheetReasignarMesero, type MeseroActivo } from './SheetReasignarMesero'
import { SheetProductoLibre } from './SheetProductoLibre'
import { HeaderB } from '@/components/ui/HeaderB'
import { AccionPill } from '@/components/ui/AccionPill'
import { Sheet } from '@/components/ui/Sheet'
import { formatCurrency } from '@/components/ui/tokens'
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
import { dispararFeedback } from '@/lib/feedback'
import type { TicketConfig } from '@/lib/print'
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
  mesasLibres?: MesaLibre[]
  mesasSatelite?: MesaSatelite[]
  puedesCancelar?: boolean
  puedeAnularPedido?: boolean
  meseroNombre?: string
  meseroActualId?: string
  meserosActivos?: MeseroActivo[]
  rol?: string
  tipoMesa?: 'mesa' | 'llevar' | 'mostrador'
  mesaSillas?: MesaSillas
  mesasCadena?: MesaCadenaItem[] | null
  ticketConfig: TicketConfig
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
  mesasLibres = [],
  mesasSatelite = [],
  puedesCancelar = false,
  puedeAnularPedido = false,
  meseroNombre = 'Mesero',
  meseroActualId,
  meserosActivos = [],
  rol = 'mesero',
  tipoMesa = 'mesa',
  mesaSillas = null,
  ticketConfig,
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
  const [sheetMoverOpen, setSheetMoverOpen] = useState(false)
  const [sheetSepararOpen, setSheetSepararOpen] = useState(false)
  const [sheetReasignarOpen, setSheetReasignarOpen] = useState(false)
  const [sheetLibreOpen, setSheetLibreOpen] = useState(false)
  const [sheetMasOpen, setSheetMasOpen] = useState(false)
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
    dispararFeedback('agregar')
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
      {/* ── Header B: flecha atrás + título + Cobrar (regla #4 CLAUDE.md) ───── */}
      <HeaderB
        backLabel="Mesas"
        onBack={() => router.push('/mesas')}
        titulo={mesaLabel}
        subtitulo={
          <div className="flex items-center gap-3 text-[12px] text-text-3">
            <span className="flex items-center gap-1">
              <Users2 size={13} strokeWidth={2.2} />
              {numComensales} comensal{numComensales !== 1 ? 'es' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 size={13} strokeWidth={2.2} />
              desde {horaApertura}
            </span>
          </div>
        }
      >
        <button
          onClick={() => router.push(`/cobro/${pedidoId}`)}
          className="flex items-center gap-1 rounded-full bg-[#173F2E] px-4 py-2 text-[13px] font-bold text-white active:scale-[.97] active:bg-[#0F2E21]"
        >
          Cobrar
          <ArrowRight size={14} strokeWidth={2.4} />
        </button>
      </HeaderB>

      {/* Fila de acciones con ícono (regla #1 CLAUDE.md) — Compartir/Mover/
          Reasignar siguen el mockup 1:1; Unir/Separar (funcionalidad real que
          el mockup no contempla, y que pueden coexistir con las otras 3) se
          agrupan detrás de "Más" en vez de sumar hasta 5 pills a la fila —
          decisión confirmada con Rober. "Más" desaparece si ninguna de las
          dos aplica en este pedido. */}
      {(mesaId || rol === 'admin') && (
        <div className="flex flex-shrink-0 items-center gap-2 overflow-x-auto border-b border-[#E5E5EA] bg-white px-4 py-2.5 scrollbar-none">
          {mesaId && (
            <AccionPill
              icon={Share2}
              label={isPendingCompartir ? '…' : 'Compartir'}
              onClick={handleCompartirMesa}
              disabled={isPendingCompartir}
            />
          )}
          {mesaId && mesasLibres.length > 0 && (
            <AccionPill icon={ArrowLeftRight} label="Mover" onClick={() => setSheetMoverOpen(true)} />
          )}
          {rol === 'admin' && (
            <AccionPill icon={UserCog} label="Reasignar" onClick={() => setSheetReasignarOpen(true)} />
          )}
          {(mesasOcupadas.length > 0 || mesasSatelite.length > 0) && (
            <AccionPill icon={MoreHorizontal} label="Más" onClick={() => setSheetMasOpen(true)} />
          )}
        </div>
      )}

      {/* Tabs Menú / Comanda */}
      <div className="flex flex-shrink-0 border-b border-[#E5E5EA] bg-white">
        <button
          onClick={() => setVista('menu')}
          className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
            vista === 'menu'
              ? 'border-[#173F2E] text-[#173F2E]'
              : 'border-transparent text-text-3'
          }`}
        >
          Menú
        </button>
        <button
          onClick={() => setVista('comanda')}
          className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
            vista === 'comanda'
              ? 'border-[#173F2E] text-[#173F2E]'
              : 'border-transparent text-text-3'
          }`}
        >
          Comanda
          {totalPedido > 0 && (
            <span className="ml-1.5 rounded-full bg-green-50 px-2 py-0.5 font-mono text-[11px] font-bold text-[#173F2E]">
              {formatCurrency(totalPedido)}
            </span>
          )}
        </button>
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
            subpedidos={subpedidos}
            subpedidoActivoId={subpedidoActivoId}
            onCambiarSubpedido={(id) => setSubpedidoActivoId(id)}
            onAgregarProducto={handleAgregarProducto}
            onAgregarLibre={() => setSheetLibreOpen(true)}
            onAgregarComensal={handleAgregarComensalMenu}
            isPendingAgregarComensal={isPendingComensalMenu}
          />
        ) : (
          <VistaComanda
            pedidoId={pedidoId}
            subpedidos={subpedidos}
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
            ticketConfig={ticketConfig}
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
      <SheetMoverMesa
        open={sheetMoverOpen}
        pedidoId={pedidoId}
        mesasLibres={mesasLibres}
        onClose={() => setSheetMoverOpen(false)}
      />
      <SheetSepararMesa
        open={sheetSepararOpen}
        pedidoId={pedidoId}
        mesasSatelite={mesasSatelite}
        onClose={() => setSheetSepararOpen(false)}
      />
      <SheetReasignarMesero
        open={sheetReasignarOpen}
        pedidoId={pedidoId}
        meseroActualId={meseroActualId}
        meseros={meserosActivos}
        onClose={() => setSheetReasignarOpen(false)}
      />
      <SheetProductoLibre
        open={sheetLibreOpen}
        onConfirmar={handleConfirmarLibre}
        onClose={() => setSheetLibreOpen(false)}
      />
      <Sheet open={sheetMasOpen} onClose={() => setSheetMasOpen(false)} title="Más acciones">
        {mesasOcupadas.length > 0 && (
          <button
            onClick={() => { setSheetMasOpen(false); setSheetUnirOpen(true) }}
            className="flex w-full items-center gap-3 rounded-xl bg-s2 px-4 py-3.5 text-left active:scale-[.98]"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#173F2E]/10 text-[#173F2E]">
              <Merge size={18} strokeWidth={2.2} />
            </span>
            <span className="text-[14px] font-semibold text-text">Unir mesa</span>
          </button>
        )}
        {mesasSatelite.length > 0 && (
          <button
            onClick={() => { setSheetMasOpen(false); setSheetSepararOpen(true) }}
            className="flex w-full items-center gap-3 rounded-xl bg-s2 px-4 py-3.5 text-left active:scale-[.98]"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#173F2E]/10 text-[#173F2E]">
              <Split size={18} strokeWidth={2.2} />
            </span>
            <span className="text-[14px] font-semibold text-text">Separar mesa</span>
          </button>
        )}
      </Sheet>
    </div>
  )
}
