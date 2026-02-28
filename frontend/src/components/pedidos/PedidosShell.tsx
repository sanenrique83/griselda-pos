'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PedidoActivo } from '@/app/(app)/pedidos/page'

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

export function PedidosShell({ pedidos }: { pedidos: PedidoActivo[] }) {
  const router = useRouter()

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
          {pedidos.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[13px] font-semibold text-blue-700">
              {pedidos.length}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-text-3">Pedidos abiertos actualmente</p>
      </div>

      <div className="px-4 py-4">
        {pedidos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {pedidos.map((p) => (
              <PedidoCard key={p.id} pedido={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tarjeta de pedido ────────────────────────────────────────────────────────

function PedidoCard({ pedido: p }: { pedido: PedidoActivo }) {
  const totalItems = p.pendientes + p.enviados + p.cancelados
  const todoEnviado = p.pendientes === 0 && p.enviados > 0

  return (
    <Link
      href={`/pos/${p.id}`}
      className="block rounded-2xl bg-white shadow-card overflow-hidden active:opacity-75"
    >
      {/* Cabecera */}
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
        <span className="ml-auto text-[18px] text-text-4">›</span>
      </div>
    </Link>
  )
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EmptyState() {
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
