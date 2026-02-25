'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TarjetaMesa } from './TarjetaMesa'
import { SheetParaLlevar } from './SheetParaLlevar'
import type { GrupoArea, MesaUI } from '@/app/(app)/mesas/page'

interface MapaMesasProps {
  grupos: GrupoArea[]
  turnoId: number | null
}

export default function MapaMesas({ grupos, turnoId }: MapaMesasProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleMesaClick(mesa: MesaUI) {
    setError(null)

    // Mesa ocupada → ir al pedido existente directamente
    if (mesa.pedido_activo) {
      router.push(`/pos/${mesa.pedido_activo.id}`)
      return
    }

    // Sin turno activo → mostrar aviso
    if (!turnoId) {
      setError('No hay turno activo. Ve a Más → Turno para abrir uno.')
      return
    }

    // Mesa libre → navegar a ruta draft (sin crear nada en BD)
    router.push(`/pos/nueva/${mesa.id}`)
  }

  const totalMesas = grupos.reduce((acc, g) => acc + g.mesas.length, 0)
  const mesasOcupadas = grupos.reduce(
    (acc, g) => acc + g.mesas.filter((m) => m.pedido_activo).length,
    0,
  )

  return (
    <>
      {/* Header */}
      <div className="flex h-[52px] flex-shrink-0 items-center gap-2.5 border-b border-[#E5E5EA] bg-white px-4">
        <h1 className="flex-1 text-[17px] font-semibold">Griselda POS</h1>
        {turnoId ? (
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-600">
            ● Turno #{turnoId}
          </span>
        ) : (
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
            Sin turno
          </span>
        )}
        <span className="text-[13px] text-text-3">
          {mesasOcupadas}/{totalMesas}
        </span>
      </div>

      {/* Cuerpo scrolleable */}
      <div className="flex-1 overflow-y-auto pb-safe">

        {/* Banner de error */}
        {error && (
          <div className="mx-3 mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 font-semibold underline"
            >
              OK
            </button>
          </div>
        )}

        {/* Botón Para llevar */}
        <div className="px-3 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-text-3">
            Para llevar
          </p>
          <button
            onClick={() => {
              if (!turnoId) {
                setError('No hay turno activo. Ve a Más → Turno para abrir uno.')
                return
              }
              setSheetOpen(true)
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-blue-600 px-4 py-4 text-white shadow-[0_4px_14px_rgba(37,99,235,.28)] active:scale-[.98]"
          >
            <span className="text-[28px] leading-none">📦</span>
            <div className="flex-1 text-left">
              <div className="text-[15px] font-semibold">Nuevo pedido para llevar</div>
              <div className="mt-0.5 text-[12px] opacity-80">
                Sin mesa · Datos opcionales
              </div>
            </div>
            <span className="text-xl opacity-70">›</span>
          </button>
        </div>

        {/* Sin mesas configuradas */}
        {grupos.length === 0 && (
          <div className="mt-12 text-center text-sm text-text-3">
            No hay mesas configuradas.
            <br />
            Agrégalas desde Más → Catálogo.
          </div>
        )}

        {/* Grupos por área */}
        {grupos.map((grupo) => (
          <div key={grupo.area_nombre}>
            {/* Sección header */}
            <p className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[.05em] text-text-3">
              Mesas — {grupo.area_nombre}
            </p>

            {/* Grid 2 columnas */}
            <div className="grid grid-cols-2 gap-2.5 px-3">
              {grupo.mesas.map((mesa) => (
                <TarjetaMesa
                  key={mesa.id}
                  mesa={mesa}
                  onClick={() => handleMesaClick(mesa)}
                  isPending={false}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="h-4" />
      </div>

      {/* Sheet Para llevar */}
      <SheetParaLlevar
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
