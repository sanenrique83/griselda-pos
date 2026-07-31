'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DiagramaSillas } from './DiagramaSillas'
import { DiagramaSillasCadena } from './DiagramaSillasCadena'
import { abrirPedidoMesa, abrirPedidoMesaCombinada } from '@/app/(app)/pos/nueva/[mesaId]/actions'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

interface ElegirSillaInicialShellProps {
  mesaId: number
  turnoId: number
  mesaLabel: string
  capacidad: number | null
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  asientosHorario: boolean
  // Combinación con una segunda mesa libre (arrastre imantado libre+libre en
  // /mas/mapa-mesas) — si viene presente, el diagrama muestra las 2 mesas en
  // cadena (DiagramaSillasCadena) y, al confirmar, se crea un solo pedido
  // combinado (abrirPedidoMesaCombinada) en vez de uno solo para `mesaId`.
  mesaSateliteId?: number
  capacidadSatelite?: number
  reposicionSatelite?: { x: number; y: number; rotacion: number } | null
}

// Paso previo a crear el pedido de una mesa vacía: el mesero elige en qué
// silla se sienta el comensal 1 — la única decisión manual de todo el flujo
// de sillas, porque establece la referencia real de esa mesa en ese
// momento (de ahí en adelante, "+ Nuevo comensal" asigna la siguiente silla
// libre en automático, sin preguntar nada).
export function ElegirSillaInicialShell({
  mesaId,
  turnoId,
  mesaLabel,
  capacidad,
  forma,
  tamano,
  rotacion,
  asientosHorario,
  mesaSateliteId,
  capacidadSatelite,
  reposicionSatelite = null,
}: ElegirSillaInicialShellProps) {
  const router = useRouter()
  const [sillaElegida, setSillaElegida] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const esCombinada = mesaSateliteId !== undefined
  const numSillas = esCombinada
    ? Math.max((capacidad ?? 1) + (capacidadSatelite ?? 1), 1)
    : Math.max(capacidad ?? 1, 1)

  function handleConfirmar() {
    if (sillaElegida === null) return
    setError(null)
    startTransition(async () => {
      const result = esCombinada
        ? await abrirPedidoMesaCombinada(
            mesaId,
            mesaSateliteId!,
            turnoId,
            sillaElegida,
            reposicionSatelite,
          )
        : await abrirPedidoMesa(mesaId, turnoId, sillaElegida)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.push(`/pos/${result.pedidoId}`)
    })
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-[#E5E5EA] px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/mesas')}
            className="-ml-1 px-1 py-1 text-[15px] font-medium text-blue-600 active:opacity-60"
          >
            ‹ Mesas
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[15px] font-semibold leading-tight truncate">{mesaLabel}</p>
          </div>
          <div className="w-12" />
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="text-center text-[16px] font-bold leading-tight">
          ¿En qué silla se sienta?
        </p>
        <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[13px] text-text-3">
          Elige la silla del primer comensal. El resto de las sillas se cuentan a
          partir de esta referencia.
        </p>

        {esCombinada ? (
          <DiagramaSillasCadena
            mesas={[{ capacidad: capacidad ?? 1 }, { capacidad: capacidadSatelite ?? 1 }]}
            renderSilla={(sillaNum) => (
              <button
                onClick={() => setSillaElegida(sillaNum)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-bold transition-transform active:scale-90 ${
                  sillaElegida === sillaNum
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-blue-400 bg-blue-50 text-blue-700'
                }`}
              >
                {sillaNum}
              </button>
            )}
          />
        ) : (
          <DiagramaSillas
            forma={forma}
            tamano={tamano}
            rotacion={rotacion}
            asientosHorario={asientosHorario}
            numSillas={numSillas}
            renderSilla={(sillaNum) => (
              <button
                onClick={() => setSillaElegida(sillaNum)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-bold transition-transform active:scale-90 ${
                  sillaElegida === sillaNum
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-blue-400 bg-blue-50 text-blue-700'
                }`}
              >
                {sillaNum}
              </button>
            )}
          />
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* Pie fijo */}
      <div className="flex-shrink-0 border-t border-[#E5E5EA] bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5">
        <button
          onClick={handleConfirmar}
          disabled={sillaElegida === null || isPending}
          className="w-full rounded-xl bg-blue-600 py-[15px] text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
        >
          {isPending
            ? 'Abriendo mesa…'
            : sillaElegida !== null
              ? `Confirmar silla ${sillaElegida} y abrir mesa`
              : 'Elige una silla para continuar'}
        </button>
      </div>
    </div>
  )
}
