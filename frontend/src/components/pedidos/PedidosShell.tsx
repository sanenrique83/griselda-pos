'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { PedidoActivo, ProductoDetalle } from '@/app/(app)/pedidos/page'

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

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─── Componente principal ─────────────────────────────────────────────────────

const LABEL_FILTRO: Record<'cocina' | 'cobro', string> = {
  cocina: 'Cocina',
  cobro: 'Cobro',
}

export function PedidosShell({ pedidos }: { pedidos: PedidoActivo[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Filtro llegado desde el atajo "Órdenes activas" de /mesas
  // (?filtro=cocina|cobro) — ver punto 5 del rediseño de Mesas.
  const filtroParam = searchParams.get('filtro')
  const filtro = filtroParam === 'cocina' || filtroParam === 'cobro' ? filtroParam : null
  const pedidosFiltrados = filtro
    ? pedidos.filter((p) => (filtro === 'cocina' ? p.enCocina : p.cobroParcial))
    : pedidos

  // Refresco automático cada 30 s
  const refresh = useCallback(() => router.refresh(), [router])
  useEffect(() => {
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold leading-tight">Pedidos</h1>
          {pedidosFiltrados.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[13px] font-semibold text-blue-700">
              {pedidosFiltrados.length}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-text-3">Pedidos abiertos actualmente</p>
      </div>

      {filtro && (
        <div className="flex items-center justify-between bg-[#173F2E]/5 px-4 py-2.5">
          <span className="text-[13px] font-semibold text-[#173F2E]">
            Filtrando: {LABEL_FILTRO[filtro]}
          </span>
          <button
            onClick={() => router.push('/pedidos')}
            className="flex items-center gap-1 text-[12px] font-semibold text-text-3 active:opacity-60"
          >
            <X size={13} strokeWidth={2.4} /> Quitar filtro
          </button>
        </div>
      )}

      <div className="px-4 py-4">
        {pedidosFiltrados.length === 0 ? (
          <EmptyState filtroActivo={filtro !== null} />
        ) : (
          <div className="space-y-3">
            {pedidosFiltrados.map((p) => (
              <PedidoCard key={p.id} pedido={p} />
            ))}
          </div>
        )}
      </div>
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
  const totalItems = p.pendientes + p.enviados + p.cancelados
  const todoEnviado = p.pendientes === 0 && p.enviados > 0

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      {/* Cabecera — tocar expande/colapsa el detalle por comensal */}
      <button
        onClick={() => setExpandido((v) => !v)}
        className="block w-full text-left active:opacity-75"
      >
        <div className="flex items-start justify-between px-4 pt-3.5 pb-3 border-b border-[#F2F2F7]">
          <div>
            <p className="text-[15px] font-semibold leading-tight">{p.mesaLabel}</p>
            <p className="mt-0.5 text-[12px] text-text-3">
              #{p.id}
              {p.tipo === 'mesa' && ` · ${p.numComensales} comensal${p.numComensales !== 1 ? 'es' : ''}`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[15px] font-bold text-blue-600">
              ${fmtMoney(p.total)}
            </p>
            <p className="mt-0.5 text-[12px] text-text-4"><ElapsedTime iso={p.createdAt} /></p>
          </div>
        </div>

        {/* Estado de ítems */}
        <div className="flex items-center gap-3 px-4 py-3">
          {totalItems === 0 ? (
            <p className="text-xs text-text-4">Sin productos</p>
          ) : (
            <>
              {p.pendientes > 0 && (
                <span className="flex items-center gap-1 text-[12px] font-medium text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {p.pendientes} pendiente{p.pendientes !== 1 ? 's' : ''}
                </span>
              )}
              {p.enviados > 0 && (
                <span className="flex items-center gap-1 text-[12px] font-medium text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {p.enviados} enviado{p.enviados !== 1 ? 's' : ''}
                </span>
              )}
              {todoEnviado && p.pendientes === 0 && (
                <span className="ml-auto text-[11px] font-semibold text-emerald-600">
                  ✓ Todo enviado
                </span>
              )}
            </>
          )}
          <span className={`ml-auto text-[18px] text-text-4 transition-transform ${expandido ? 'rotate-90' : ''}`}>
            ›
          </span>
        </div>
      </button>

      {/* Detalle por comensal */}
      {expandido && (
        <div className="border-t border-[#F2F2F7] divide-y divide-[#F2F2F7]">
          {p.comensales.every((c) => c.productos.length === 0) ? (
            <p className="px-4 py-3 text-xs text-text-4">Sin productos todavía.</p>
          ) : (
            p.comensales.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
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
                          {prod.estado === 'enviado' && prod.enviadoEn && (
                            <span className="flex-shrink-0 text-[11px] text-text-4">
                              hace <ElapsedTime iso={prod.enviadoEn} />
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))
          )}
          <Link
            href={`/pos/${p.id}`}
            className="block px-4 py-3 text-center text-[13px] font-semibold text-blue-600 active:opacity-60"
          >
            Abrir comanda →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EmptyState({ filtroActivo }: { filtroActivo: boolean }) {
  if (filtroActivo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[48px] mb-3">🔍</p>
        <p className="text-[15px] font-semibold text-text-2">Sin pedidos en este filtro</p>
        <p className="mt-1 text-sm text-text-3">Prueba quitando el filtro para ver todos.</p>
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
        className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white active:opacity-80"
      >
        Ir a Mesas
      </Link>
    </div>
  )
}
