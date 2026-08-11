'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search, ChevronRight, ChevronDown, ArrowRight, Armchair, ShoppingBag,
  ChefHat, CreditCard, Clock,
} from 'lucide-react'
import type { PedidoActivo, ProductoDetalle } from '@/app/(app)/pedidos/page'
import { HeaderA } from '@/components/ui/HeaderA'
import { Boton } from '@/components/ui/Boton'
import { formatCurrency } from '@/components/ui/tokens'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// Componente separado para evitar mismatch de hidratación (Date.now() difiere server vs client)
function ElapsedTime({ iso }: { iso: string }) {
  const [text, setText] = useState('')
  useEffect(() => { setText(elapsed(iso)) }, [iso])
  return <>{text}</>
}

type Filtro = 'todas' | 'cocina' | 'cobro'

// ─── Componente principal ─────────────────────────────────────────────────────

export function PedidosShell({ pedidos, turnoId }: { pedidos: PedidoActivo[]; turnoId: number | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Refresco automático cada 30 s (ya existía).
  const refresh = useCallback(() => router.refresh(), [router])
  useEffect(() => {
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  // Filtro inicial: llega desde el atajo "Órdenes activas" de /mesas
  // (?filtro=cocina|cobro) — a partir de aquí es una chip normal, estado
  // local (no se sincroniza de vuelta a la URL).
  const filtroParam = searchParams.get('filtro')
  const [filtro, setFiltro] = useState<Filtro>(
    filtroParam === 'cocina' || filtroParam === 'cobro' ? filtroParam : 'todas',
  )
  const [busqueda, setBusqueda] = useState('')

  const cocinaCount = pedidos.filter((p) => p.enCocina).length
  const cobroCount = pedidos.filter((p) => p.cobroParcial).length

  const pedidosFiltrados = useMemo(() => {
    const porChip = pedidos.filter((p) => {
      if (filtro === 'cocina') return p.enCocina
      if (filtro === 'cobro') return p.cobroParcial
      return true
    })
    const q = busqueda.trim().toLowerCase()
    if (!q) return porChip
    return porChip.filter((p) => {
      const campos = [
        p.mesaLabel,
        String(p.id),
        p.meseroNombre,
        p.clienteNombre ?? '',
        ...p.comensales.map((c) => c.nombre ?? ''),
      ]
      return campos.some((c) => c.toLowerCase().includes(q))
    })
  }, [pedidos, filtro, busqueda])

  // Estadísticas — mismo criterio que "Órdenes activas" en Mesas: sin
  // "Pendientes por servir" (no existe un estado real de "listo para
  // servir" distinto de "enviado") ni "Reservadas" (no existe esa feature).
  const mesasAbiertas = pedidos.filter((p) => p.tipo === 'mesa').length
  const pendientesCocina = pedidos.reduce((s, p) => s + p.pendientes, 0)
  const cobrosPendientesMonto = pedidos.reduce((s, p) => s + p.montoPendienteCobro, 0)

  return (
    <div className="flex min-h-full flex-col bg-s2">
      <HeaderA
        titulo="Pedidos"
        subtitulo={`${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} abierto${pedidos.length !== 1 ? 's' : ''}`}
        turnoId={turnoId}
      />

      {/* Búsqueda — sin botón de escaneo/filtros aparte: no hay ninguna
          función real de escaneo de folio, y el único filtro adicional real
          (estado) ya está cubierto por las chips de abajo (mismo criterio
          ya aplicado en Menú/Comanda/Captura rápida). */}
      <div className="flex-shrink-0 border-b border-[#E5E5EA] bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-xl bg-s2 px-3 py-2.5">
          <Search size={17} strokeWidth={2.2} className="flex-shrink-0 text-text-3" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar mesa, cliente o folio…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text placeholder:text-text-3 focus:outline-none"
          />
        </div>
      </div>

      {/* Chips de filtro — patrón "chip de filtro" (regla #1 CLAUDE.md).
          Solo Todas/Cocina/Cobro: son los únicos 3 estados reales que ya
          calcula la página (enCocina/cobroParcial). Sin "Servir" (no existe
          un estado real distinto de "enviado") ni "Reservadas" (no existe
          esa feature en la app). */}
      <div className="flex flex-shrink-0 items-center gap-2 overflow-x-auto border-b border-[#E5E5EA] bg-white px-3 pb-3 scrollbar-none">
        {([
          ['todas', `Todas (${pedidos.length})`],
          ['cocina', `Cocina (${cocinaCount})`],
          ['cobro', `Cobro (${cobroCount})`],
        ] as [Filtro, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filtro === id ? 'bg-[#173F2E] text-white' : 'bg-s2 text-text-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {pedidosFiltrados.length === 0 ? (
          <EmptyState filtroActivo={filtro !== 'todas'} busquedaActiva={busqueda.trim() !== ''} />
        ) : (
          <div className="space-y-3">
            {pedidosFiltrados.map((p) => (
              <PedidoCard key={p.id} pedido={p} />
            ))}
          </div>
        )}

        {pedidos.length > 0 && (
          // 3 tiles, no 4: se omite a propósito "Pendientes por servir" del
          // mockup — no existe un estado real de "listo para servir"
          // distinto de "enviado" (mismo criterio que "Órdenes activas" en
          // Mesas, ver MesasShell.tsx).
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile icon={<Armchair size={18} strokeWidth={2.2} />} valor={String(mesasAbiertas)} label="Mesas abiertas" />
            <StatTile icon={<ChefHat size={18} strokeWidth={2.2} />} valor={String(pendientesCocina)} label="Pendientes en cocina" tint="amber" />
            <StatTile icon={<CreditCard size={18} strokeWidth={2.2} />} valor={formatCurrency(cobrosPendientesMonto)} label="Cobros pendientes" tint="blue" small />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Fila de estadísticas ─────────────────────────────────────────────────────

function StatTile({
  icon, valor, label, tint = 'neutral', small = false,
}: {
  icon: React.ReactNode
  valor: string
  label: string
  tint?: 'neutral' | 'amber' | 'blue'
  small?: boolean
}) {
  const tintClases = {
    neutral: 'bg-s2 text-text-2',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  }[tint]
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3 text-center shadow-card">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tintClases}`}>{icon}</span>
      <p className={`${small ? 'text-[13px]' : 'text-[15px]'} font-bold leading-none text-text`}>{valor}</p>
      <p className="text-[10px] leading-tight text-text-3">{label}</p>
    </div>
  )
}

// ─── Tarjeta de pedido ────────────────────────────────────────────────────────

const ESTILO_ESTADO_PRODUCTO: Record<
  ProductoDetalle['estado'],
  { dot: string; texto: string }
> = {
  pendiente: { dot: 'bg-amber-400', texto: 'text-text-2' },
  enviado: { dot: 'bg-emerald-400', texto: 'text-text-2' },
  cancelado: { dot: 'bg-[#D1D1D6]', texto: 'text-text-4 line-through' },
}

function PedidoCard({ pedido: p }: { pedido: PedidoActivo }) {
  const [expandido, setExpandido] = useState(false)

  // Tinte del ícono/monto — a partir de flags reales ya calculados
  // (cobroParcial/enCocina), no de un umbral de tiempo transcurrido
  // inventado (el mockup usa color por urgencia de tiempo, pero no existe
  // ningún umbral real configurado para pedidos — a diferencia de la alerta
  // de mesa sin atender, que es un concepto distinto). Azul = mismo
  // significado que el semáforo de mesa (cobro parcial); ámbar = tiene
  // productos ya enviados a cocina; verde bosque = nada urgente.
  const tint = p.cobroParcial
    ? { icon: 'bg-blue-50 text-blue-600', monto: 'text-blue-600' }
    : p.enCocina
      ? { icon: 'bg-amber-50 text-amber-600', monto: 'text-blue-600' }
      : { icon: 'bg-[#173F2E]/10 text-[#173F2E]', monto: 'text-blue-600' }

  const detalleSecundario =
    p.tipo === 'mesa'
      ? `${p.numComensales} comensal${p.numComensales !== 1 ? 'es' : ''}`
      : p.tipo === 'llevar' && p.clienteNombre
        ? `Cliente: ${p.clienteNombre}`
        : p.tipo === 'mostrador'
          ? 'Mostrador'
          : 'Para llevar'

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      {/* Cabecera — navega directo a la comanda (mismo destino que "Abrir
          comanda" de abajo, solo un atajo más rápido). */}
      <Link
        href={`/pos/${p.id}`}
        className="flex items-start gap-3 px-4 pt-3.5 pb-3 active:opacity-75"
      >
        <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tint.icon}`}>
          {p.tipo === 'mesa' ? <Armchair size={20} strokeWidth={2} /> : <ShoppingBag size={20} strokeWidth={2} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">{p.mesaLabel}</p>
          <p className="mt-0.5 truncate text-[12px] text-text-3">{p.meseroNombre} (Mesero)</p>
          <p className="mt-0.5 text-[12px] text-text-3">
            #{p.id} · {detalleSecundario}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={`font-mono text-[15px] font-bold ${tint.monto}`}>{formatCurrency(p.total)}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-s2 px-2 py-0.5 text-[11px] font-medium text-text-3">
            <Clock size={11} strokeWidth={2.4} />
            <ElapsedTime iso={p.createdAt} />
          </span>
        </div>
        <ChevronRight size={18} strokeWidth={2.2} className="mt-1 flex-shrink-0 text-text-4" />
      </Link>

      {/* Badge de pendientes / toggle de desglose por comensal */}
      <button
        onClick={() => setExpandido((v) => !v)}
        className="flex w-full items-center gap-2 border-t border-[#F2F2F7] px-4 py-2.5 text-left active:bg-s2"
      >
        {p.pendientes > 0 ? (
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {p.pendientes} producto{p.pendientes !== 1 ? 's' : ''} pendiente{p.pendientes !== 1 ? 's' : ''} en cocina
          </span>
        ) : p.enviados > 0 ? (
          <span className="text-[12px] font-semibold text-emerald-600">✓ Todo enviado</span>
        ) : (
          <span className="text-[12px] text-text-4">Sin productos todavía</span>
        )}
        <ChevronDown
          size={16}
          strokeWidth={2.4}
          className={`ml-auto flex-shrink-0 text-text-4 transition-transform ${expandido ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Detalle por comensal */}
      {expandido && (
        <div className="border-t border-[#F2F2F7]">
          <div className="divide-y divide-[#F2F2F7]">
            {p.comensales.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-s2 text-[13px] font-bold text-text-2">
                  {c.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                    {c.nombre || `Comensal ${c.numero}`}
                  </p>
                  {c.productos.length === 0 ? (
                    <p className="text-xs text-text-4">Sin productos</p>
                  ) : (
                    <div className="space-y-1">
                      {c.productos.map((prod) => {
                        const estilo = ESTILO_ESTADO_PRODUCTO[prod.estado]
                        return (
                          <div key={prod.id} className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${estilo.dot}`} />
                            <span className={`flex-1 text-[13px] ${estilo.texto}`}>
                              {prod.cantidad}× {prod.nombre}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <p className="flex-shrink-0 font-mono text-[14px] font-bold text-blue-600">
                  {formatCurrency(c.subtotal)}
                </p>
              </div>
            ))}
          </div>
          <div className="p-3">
            <Boton href={`/pos/${p.id}`} variant="outline">
              Abrir comanda
              <ArrowRight size={16} strokeWidth={2.4} />
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EmptyState({ filtroActivo, busquedaActiva }: { filtroActivo: boolean; busquedaActiva: boolean }) {
  if (filtroActivo || busquedaActiva) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[48px] mb-3">🔍</p>
        <p className="text-[15px] font-semibold text-text-2">Sin pedidos que coincidan</p>
        <p className="mt-1 text-sm text-text-3">Prueba quitando el filtro o la búsqueda.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[48px] mb-3">🍽️</p>
      <p className="text-[15px] font-semibold text-text-2">Sin pedidos activos</p>
      <p className="mt-1 text-sm text-text-3">
        Los pedidos abiertos aparecerán aquí.
      </p>
      <Link
        href="/mesas"
        className="mt-5 rounded-xl bg-[#173F2E] px-5 py-3 text-sm font-semibold text-white active:opacity-80"
      >
        Ir a Mesas
      </Link>
    </div>
  )
}
