'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TarjetaMesa } from './TarjetaMesa'
import { PlanoMesas } from './PlanoMesas'
import { SheetParaLlevar } from './SheetParaLlevar'
import { SheetMesaExtra } from './SheetMesaExtra'
import { abrirPedidoMostrador } from '@/app/(app)/mesas/actions'
import type { GrupoArea, MesaUI } from '@/app/(app)/mesas/page'
import type { AlertaVentasBajas } from '@/lib/alertaVentasBajas'

interface MesasShellProps {
  grupos: GrupoArea[]
  mesas: MesaUI[]
  hayMapa: boolean
  turnoId: number | null
  alertaActiva: boolean
  alertaMinutos: number
  tiempoMesaAlertaMinutos: number
  // F9-06 — ya viene resuelta desde el servidor: null si está apagada, sin
  // suficiente historial, o si no aplica para este rol (solo admin la ve).
  alertaVentasBajas: AlertaVentasBajas | null
}

// Selector de pestaña de área para la vista de Mapa — el id real de un área,
// o 'sin_area' para mesas con area_id nulo (ej. "+ Mesa extra"). Cada área
// tiene su propio espacio de coordenadas (ver PlanoMesas/LienzoMesasEditor),
// así que sin filtrar por pestaña el lienzo mezclaría mesas de áreas
// distintas que pueden compartir las mismas coordenadas.
type AreaMapaTabId = number | 'sin_area'

function construirAreasMapa(mesas: MesaUI[]): { id: AreaMapaTabId; nombre: string; orden: number }[] {
  const map = new Map<AreaMapaTabId, { nombre: string; orden: number }>()
  for (const m of mesas) {
    const id: AreaMapaTabId = m.area_id ?? 'sin_area'
    if (!map.has(id)) {
      map.set(id, { nombre: m.area_nombre, orden: m.area_id === null ? Infinity : m.area_orden })
    }
  }
  return [...map.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => a.orden - b.orden)
}

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function MesasShell({
  grupos,
  mesas,
  hayMapa,
  turnoId,
  alertaActiva,
  alertaMinutos,
  tiempoMesaAlertaMinutos,
  alertaVentasBajas,
}: MesasShellProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMesaExtraOpen, setSheetMesaExtraOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPendingMostrador, startMostrador] = useTransition()
  // Si hay al menos una mesa posicionada, el mapa es la vista por default;
  // si no, no tiene caso mostrarlo (estaría vacío) y se arranca en lista.
  const [vista, setVista] = useState<'mapa' | 'lista'>(hayMapa ? 'mapa' : 'lista')

  // Pestañas de área para la vista de Mapa — mismo criterio que
  // /mas/mapa-mesas (ver LienzoMesasEditor), aquí solo para ver/arrastrar,
  // sin opción de crear área nueva. Si el negocio solo tiene una área en
  // uso, no tiene caso mostrar pestañas de una sola opción.
  const areasMapa = construirAreasMapa(mesas)
  const [areaMapaSeleccionada, setAreaMapaSeleccionada] = useState<AreaMapaTabId>(
    () => areasMapa[0]?.id ?? 'sin_area',
  )
  const mesasParaMapa =
    areasMapa.length > 1
      ? mesas.filter((m) => (areaMapaSeleccionada === 'sin_area' ? m.area_id === null : m.area_id === areaMapaSeleccionada))
      : mesas

  // Reloj compartido para el semáforo rojo (mesa sin atender por tiempo) —
  // un solo interval para todas las tarjetas/mesas del plano, en vez de uno
  // por tarjeta, y así la condición de "ya pasaron N minutos" se reevalúa
  // sin necesitar refrescar la página entera.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  function handleVentaRapida() {
    if (!turnoId) {
      setError('No hay turno activo. Ve a Más → Turno para abrir uno.')
      return
    }
    setError(null)
    startMostrador(async () => {
      const result = await abrirPedidoMostrador()
      if (result?.error) setError(result.error)
    })
  }

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

        {/* Alerta de ventas bajas en tiempo real (F9-06) — solo admin */}
        {alertaVentasBajas && (
          <div className="mx-3 mt-3 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-3.5 py-3">
            <span className="text-[18px]">📉</span>
            <div>
              <p className="text-xs font-semibold text-red-700">
                Ventas {Math.abs(alertaVentasBajas.desviacionPct).toFixed(0)}% por debajo de lo normal
                para esta hora
              </p>
              <p className="mt-0.5 text-[11px] text-red-600">
                ${fmtMoney(alertaVentasBajas.totalActual)} cobrado vs. ${fmtMoney(alertaVentasBajas.promedioHistorico)}{' '}
                en promedio a esta hora, mismo día de la semana.
              </p>
            </div>
          </div>
        )}

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

        {/* Botón Venta rápida (mostrador) */}
        <div className="px-3 pt-2.5">
          <button
            onClick={handleVentaRapida}
            disabled={isPendingMostrador}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-emerald-600 px-4 py-4 text-white shadow-[0_4px_14px_rgba(5,150,105,.28)] active:scale-[.98] disabled:opacity-60"
          >
            <span className="text-[28px] leading-none">🛍️</span>
            <div className="flex-1 text-left">
              <div className="text-[15px] font-semibold">
                {isPendingMostrador ? 'Creando…' : 'Venta rápida'}
              </div>
              <div className="mt-0.5 text-[12px] opacity-80">
                Sin mesa · Directo al menú
              </div>
            </div>
            <span className="text-xl opacity-70">›</span>
          </button>
        </div>

        {/* Botón + Mesa extra */}
        <div className="px-3 pt-2.5">
          <button
            onClick={() => {
              if (!turnoId) {
                setError('No hay turno activo. Ve a Más → Turno para abrir uno.')
                return
              }
              setSheetMesaExtraOpen(true)
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-dashed border-[#D1D1D6] bg-white px-4 py-3.5 text-text-2 active:scale-[.98]"
          >
            <span className="text-[22px] leading-none">➕</span>
            <div className="flex-1 text-left">
              <div className="text-[14px] font-semibold">Mesa extra</div>
              <div className="mt-0.5 text-[12px] text-text-3">
                Para grupos que no caben en las mesas normales
              </div>
            </div>
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

        {/* Toggle mapa / lista */}
        {grupos.length > 0 && hayMapa && (
          <div className="flex justify-center px-3 pt-4">
            <div className="inline-flex rounded-xl bg-s2 p-1">
              <button
                onClick={() => setVista('mapa')}
                className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  vista === 'mapa' ? 'bg-white text-text-1 shadow-card' : 'text-text-3'
                }`}
              >
                🗺️ Mapa
              </button>
              <button
                onClick={() => setVista('lista')}
                className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  vista === 'lista' ? 'bg-white text-text-1 shadow-card' : 'text-text-3'
                }`}
              >
                ☰ Lista
              </button>
            </div>
          </div>
        )}

        {/* Pestañas de área (vista de mapa, solo si hay más de una área en uso) */}
        {grupos.length > 0 && vista === 'mapa' && hayMapa && areasMapa.length > 1 && (
          <div className="flex overflow-x-auto scrollbar-none px-3 pt-3">
            {areasMapa.map((a) => (
              <button
                key={String(a.id)}
                onClick={() => setAreaMapaSeleccionada(a.id)}
                className={`flex-shrink-0 mr-4 last:mr-0 border-b-2 px-1 py-2 text-[13px] font-semibold transition-colors ${
                  areaMapaSeleccionada === a.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-text-3'
                }`}
              >
                {a.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Vista de mapa */}
        {grupos.length > 0 && vista === 'mapa' && hayMapa && (
          <PlanoMesas
            mesas={mesasParaMapa}
            onMesaClick={handleMesaClick}
            onUnionError={setError}
            ahora={ahora}
            alertaActiva={alertaActiva}
            alertaMinutos={alertaMinutos}
            tiempoMesaAlertaMinutos={tiempoMesaAlertaMinutos}
          />
        )}

        {/* Vista de lista: grupos por área */}
        {grupos.length > 0 && (vista === 'lista' || !hayMapa) &&
          grupos.map((grupo) => (
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
                    alertaActiva={alertaActiva}
                    alertaMinutos={alertaMinutos}
                    tiempoMesaAlertaMinutos={tiempoMesaAlertaMinutos}
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

      {/* Sheet Mesa extra */}
      <SheetMesaExtra
        open={sheetMesaExtraOpen}
        onClose={() => setSheetMesaExtraOpen(false)}
        areaId={areaMapaSeleccionada === 'sin_area' ? null : areaMapaSeleccionada}
      />
    </>
  )
}
