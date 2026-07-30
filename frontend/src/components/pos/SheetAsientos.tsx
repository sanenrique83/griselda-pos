'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DiagramaSillas } from './DiagramaSillas'
import { asignarSilla } from '@/app/(app)/pos/[pedidoId]/actions'
import type { SubpedidoPOS, MesaSillas } from '@/app/(app)/pos/[pedidoId]/page'

interface SheetAsientosProps {
  open: boolean
  onClose: () => void
  subpedidos: SubpedidoPOS[]
  mesaSillas: MesaSillas
}

// Reasignación manual — agregar un comensal nuevo ya no pasa por aquí (se
// asigna la siguiente silla libre en automático, sin picker), así que este
// sheet solo se abre desde el botón "🪑 Sillas" para corregir a mano si
// alguien terminó sentado distinto al orden automático.
export function SheetAsientos({
  open,
  onClose,
  subpedidos,
  mesaSillas,
}: SheetAsientosProps) {
  const router = useRouter()
  const [comensalSeleccionadoId, setComensalSeleccionadoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setComensalSeleccionadoId(null)
      setError(null)
    }
  }, [open])

  function handleClose() {
    setComensalSeleccionadoId(null)
    setError(null)
    onClose()
  }

  function handleTapSilla(sillaNum: number, ocupante: SubpedidoPOS | undefined) {
    if (comensalSeleccionadoId === null || isPending) return
    if (ocupante && ocupante.id !== comensalSeleccionadoId) return // ocupada por otro comensal

    // Tocar tu propia silla actual la libera (permite "des-asignar").
    const nuevaSilla = ocupante ? null : sillaNum
    setError(null)
    startTransition(async () => {
      const result = await asignarSilla(comensalSeleccionadoId, nuevaSilla)
      if (result?.error) {
        setError(result.error)
        return
      }
      setComensalSeleccionadoId(null)
      router.refresh()
    })
  }

  const numSillas = mesaSillas
    ? Math.max(mesaSillas.capacidad ?? 0, subpedidos.length, 1)
    : 0

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={handleClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">Asientos</h2>
          <p className="mt-0.5 text-[13px] text-text-3">
            {comensalSeleccionadoId === null
              ? 'Toca un comensal y luego una silla vacía.'
              : 'Toca una silla vacía para asignarla — o su propia silla para quitarla.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!mesaSillas ? (
            <p className="py-8 text-center text-sm text-text-3">
              Este pedido no tiene mesa asignada.
            </p>
          ) : (
            <>
              {/* ── Diagrama de la mesa con marcadores de silla ─────────────── */}
              <DiagramaSillas
                forma={mesaSillas.forma}
                tamano={mesaSillas.tamano}
                rotacion={mesaSillas.rotacion}
                asientosHorario={mesaSillas.asientosHorario}
                numSillas={numSillas}
                renderSilla={(sillaNum) => {
                  const ocupante = subpedidos.find((s) => s.silla_numero === sillaNum)
                  const esPropia = ocupante?.id === comensalSeleccionadoId
                  const asignable = comensalSeleccionadoId !== null && !ocupante
                  const tappable = asignable || esPropia

                  return (
                    <button
                      onClick={() => handleTapSilla(sillaNum, ocupante)}
                      disabled={!tappable || isPending}
                      title={
                        ocupante
                          ? `Silla ${sillaNum} — ${ocupante.nombre ?? `Comensal ${ocupante.comensal_numero}`}`
                          : `Silla ${sillaNum} — vacía`
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[12px] font-bold transition-transform ${
                        esPropia
                          ? 'border-amber-500 bg-amber-50 text-amber-700 active:scale-90'
                          : ocupante
                            ? 'border-[#D1D1D6] bg-s2 text-text-3'
                            : asignable
                              ? 'border-blue-500 bg-blue-50 text-blue-700 active:scale-90'
                              : 'border-[#E5E5EA] bg-white text-text-4'
                      } ${!tappable ? 'cursor-default' : ''}`}
                    >
                      {sillaNum}
                    </button>
                  )
                }}
              />

              {/* ── Lista de comensales ──────────────────────────────────────── */}
              <div className="space-y-2">
                {subpedidos.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setComensalSeleccionadoId(s.id)}
                    className={`w-full flex items-center justify-between rounded-xl border-[1.5px] px-4 py-3 text-left transition-all active:scale-[.98] ${
                      comensalSeleccionadoId === s.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-[#D1D1D6] bg-white'
                    }`}
                  >
                    <span className="text-[14px] font-medium">
                      {s.nombre ?? `Comensal ${s.comensal_numero}`}
                    </span>
                    <span className="text-[12px] font-semibold text-text-3">
                      {s.silla_numero ? `Silla ${s.silla_numero}` : 'Sin silla'}
                    </span>
                  </button>
                ))}
              </div>

              {error && (
                <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5">
          <button
            onClick={handleClose}
            className="w-full rounded-xl bg-s2 py-[14px] text-sm font-semibold text-text-2 active:scale-[.98]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  )
}
