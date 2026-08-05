'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  UtensilsCrossed,
  Users2,
  Armchair,
  Users,
  Receipt,
  Clock3,
  Wallet,
  LayoutGrid,
  ChefHat,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import { TarjetaMesa } from './TarjetaMesa'
import { PlanoMesas } from './PlanoMesas'
import { SheetParaLlevar } from './SheetParaLlevar'
import { SheetMesaExtra } from './SheetMesaExtra'
import { SheetNotificaciones } from './SheetNotificaciones'
import { SheetTurnos } from './SheetTurnos'
import { abrirPedidoMostrador } from '@/app/(app)/mesas/actions'
import type {
  GrupoArea,
  MesaUI,
  PanelTurno,
  AlertaPrecuentaMesa,
  OrdenesActivas,
  TurnoCerradoResumen,
  TurnoVista,
} from '@/app/(app)/mesas/page'
import type { AlertaVentasBajas } from '@/lib/alertaVentasBajas'
import { HeaderA } from '@/components/ui/HeaderA'
import { AccionIcono } from '@/components/ui/AccionIcono'
import { formatCurrency, texto } from '@/components/ui/tokens'
import { colorSemaforoMesa, ESTILO_COLOR_MESA, type ColorMesa } from '@/lib/colorMesa'

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
  alertaPrecuentaActiva: boolean
  alertaPrecuentaMinutos: number
  alertasPrecuenta: AlertaPrecuentaMesa[]
  nombreUsuario: string
  saludo: string
  panelTurno: PanelTurno
  ordenesActivas: OrdenesActivas
  campanaCount: number
  esAdmin: boolean
  turnosCerrados: TurnoCerradoResumen[]
  turnoVista: TurnoVista
}

// Regla de diseño transversal #2 (CLAUDE.md): exactamente los 5 estados
// reales de lib/colorMesa.ts, mismo texto que ya usa TarjetaMesa — la
// leyenda no inventa un sexto estado ni renombra los existentes.
const LABEL_LEYENDA: Record<ColorMesa, string> = {
  verde: 'Libre',
  naranja: 'Ocupada',
  azul: 'Cobro parcial',
  rojo: 'Sin atender',
  gris: 'Fuera de servicio',
}
const ORDEN_LEYENDA: ColorMesa[] = ['verde', 'naranja', 'azul', 'rojo', 'gris']

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

export function MesasShell({
  grupos,
  mesas,
  hayMapa,
  turnoId,
  alertaActiva,
  alertaMinutos,
  tiempoMesaAlertaMinutos,
  alertaVentasBajas,
  alertaPrecuentaActiva,
  alertaPrecuentaMinutos,
  alertasPrecuenta,
  nombreUsuario,
  saludo,
  panelTurno,
  ordenesActivas,
  campanaCount,
  esAdmin,
  turnosCerrados,
  turnoVista,
}: MesasShellProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMesaExtraOpen, setSheetMesaExtraOpen] = useState(false)
  const [notificacionesOpen, setNotificacionesOpen] = useState(false)
  const [sheetTurnosOpen, setSheetTurnosOpen] = useState(false)
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

    // Fuera de servicio (y sin pedido activo) → no es seleccionable para
    // abrir un pedido nuevo.
    if (mesa.fuera_de_servicio) {
      setError('Esta mesa está fuera de servicio.')
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

  // Conteos de la leyenda de color — mismo semáforo que cada TarjetaMesa/
  // MesaShape individual (colorSemaforoMesa), reevaluado con el mismo reloj
  // compartido `ahora` para que no se desincronice con el resto de la
  // pantalla.
  const conteoLeyenda = useMemo(() => {
    const conteo: Record<ColorMesa, number> = { verde: 0, naranja: 0, azul: 0, rojo: 0, gris: 0 }
    for (const m of mesas) {
      const color = colorSemaforoMesa(
        {
          ocupada: m.pedido_activo !== null,
          algunoPagadoNoTodos: m.pedido_activo?.algunoPagadoNoTodos ?? false,
          tieneProductos: m.pedido_activo?.tieneProductos ?? false,
          pedidoCreatedAt: m.pedido_activo?.created_at ?? null,
          alertaActiva,
          alertaMinutos,
          fueraDeServicio: m.fuera_de_servicio,
        },
        ahora,
      )
      conteo[color]++
    }
    return conteo
  }, [mesas, alertaActiva, alertaMinutos, ahora])

  return (
    <>
      <HeaderA
        titulo="Griselda POS"
        subtitulo="La Menudería"
        turnoId={turnoId}
        campanaCount={campanaCount}
        onCampanaClick={() => setNotificacionesOpen(true)}
        onTurnoClick={esAdmin ? () => setSheetTurnosOpen(true) : undefined}
      />

      {/* Cuerpo scrolleable */}
      <div className="flex-1 overflow-y-auto pb-safe">

        {/* Saludo personalizado */}
        <div className="px-4 pt-4">
          <p className={`${texto.tituloPantalla} leading-tight`}>
            ¡{saludo}, {nombreUsuario}! 👋
          </p>
          <p className={`mt-0.5 ${texto.etiqueta}`}>¿Qué deseas hacer hoy?</p>
        </div>

        {/* 3 tarjetas de acceso rápido — mismas acciones de siempre (Para
            llevar / Venta rápida / Mesa extra), solo con la disposición del
            mockup (grid de 3, "acción con ícono"). */}
        <div className="grid grid-cols-3 gap-2 px-3 pt-3.5" style={{ gridAutoRows: '1fr' }}>
          <AccionIcono
            variant="primaria"
            icon={Plus}
            label="Nueva orden para llevar"
            onClick={() => {
              if (!turnoId) {
                setError('No hay turno activo. Ve a Más → Turno para abrir uno.')
                return
              }
              setSheetOpen(true)
            }}
          />
          <AccionIcono
            icon={UtensilsCrossed}
            label="Venta rápida"
            sublabel="Directo al menú"
            tintBg="bg-amber-50"
            tintText="text-amber-600"
            onClick={handleVentaRapida}
            disabled={isPendingMostrador}
          />
          <AccionIcono
            icon={Users2}
            label="Mesa grande"
            sublabel="Grupos grandes"
            tintBg="bg-green-50"
            tintText="text-green-700"
            onClick={() => {
              if (!turnoId) {
                setError('No hay turno activo. Ve a Más → Turno para abrir uno.')
                return
              }
              setSheetMesaExtraOpen(true)
            }}
          />
        </div>

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

        {/* Sin mesas configuradas */}
        {grupos.length === 0 && (
          <div className="mt-12 text-center text-sm text-text-3">
            No hay mesas configuradas.
            <br />
            Agrégalas desde Más → Catálogo.
          </div>
        )}

        {/* Aviso de turno histórico (punto 3 del rediseño, solo Admin) — para
            que nunca se confunda un turno cerrado con el turno activo. Solo
            afecta al Panel del turno de abajo; el mapa/lista de mesas sigue
            siempre en vivo. */}
        {turnoVista && (
          <div className="mx-3 mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
            <span className="text-[12px] font-semibold text-amber-800">
              Viendo Turno #{turnoVista.id} — cerrado {turnoVista.fechaCierre}
            </span>
            <button
              onClick={() => router.push('/mesas')}
              className="flex-shrink-0 text-[12px] font-semibold text-amber-800 underline active:opacity-60"
            >
              Volver al activo
            </button>
          </div>
        )}

        {/* Panel del turno — resumen operativo, escopeado a mesas ocupadas
            (ver PanelTurno en mesas/page.tsx). Fila horizontal deslizable:
            5 columnas no caben cómodo en una pantalla angosta. */}
        {grupos.length > 0 && (
          <div className="px-3 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-text-3">
              Panel del turno
            </p>
            <div className="flex flex-wrap gap-x-1 gap-y-3 rounded-2xl bg-white p-3 shadow-card">
              <StatTile icon={Armchair} label="Mesas ocupadas" value={String(panelTurno.mesasOcupadas)} valueClass="text-[#173F2E]" />
              <StatTile icon={Users} label="Clientes" value={String(panelTurno.clientes)} valueClass="text-[#173F2E]" />
              <StatTile icon={Receipt} label="Ticket promedio" value={formatCurrency(panelTurno.ticketPromedio)} valueClass="text-[#173F2E]" />
              <StatTile icon={Clock3} label="Tiempo promedio" value={`${panelTurno.tiempoPromedioMin} min`} valueClass="text-text" />
              <StatTile
                icon={Wallet}
                label={turnoVista ? 'Total cobrado' : 'Cobro pendiente'}
                value={formatCurrency(panelTurno.cobroPendiente)}
                tintBg="bg-red-50"
                tintText="text-red-600"
                valueClass="text-red-600"
              />
            </div>
          </div>
        )}

        {/* Mesas — título + toggle mapa/lista, misma fila (como el mockup) */}
        {grupos.length > 0 && (
          <div className="flex items-center justify-between px-3 pt-5">
            <p className={texto.encabezadoSeccion}>Mesas</p>
            {hayMapa && (
              <div className="inline-flex rounded-xl bg-s2 p-1">
                <button
                  onClick={() => setVista('mapa')}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    vista === 'mapa' ? 'bg-[#173F2E] text-white shadow-card' : 'text-text-3'
                  }`}
                >
                  <LayoutGrid size={15} strokeWidth={2.2} /> Mapa
                </button>
                <button
                  onClick={() => setVista('lista')}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    vista === 'lista' ? 'bg-[#173F2E] text-white shadow-card' : 'text-text-3'
                  }`}
                >
                  ☰ Lista
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leyenda de colores — los 5 estados reales de lib/colorMesa.ts, sin
            cambiar cuáles son ni lo que significan (solo el estilo visual:
            chip con borde/fondo tenue del mismo color, en vez de un punto
            suelto). flex-wrap para no desbordar a ancho de iPhone (~375px). */}
        {grupos.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {ORDEN_LEYENDA.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] text-text-2"
                style={{ backgroundColor: ESTILO_COLOR_MESA[c].bg, borderColor: ESTILO_COLOR_MESA[c].border }}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: ESTILO_COLOR_MESA[c].dot }}
                />
                {LABEL_LEYENDA[c]} <span className="font-semibold">{conteoLeyenda[c]}</span>
              </span>
            ))}
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
            alertaPrecuentaActiva={alertaPrecuentaActiva}
            alertaPrecuentaMinutos={alertaPrecuentaMinutos}
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
                    alertaPrecuentaActiva={alertaPrecuentaActiva}
                    alertaPrecuentaMinutos={alertaPrecuentaMinutos}
                  />
                ))}
              </div>
            </div>
          ))}

        {/* Órdenes activas — atajo, no resumen pasivo (punto 5 del rediseño):
            cada tile navega a /pedidos ya filtrado. Escopeado a mesas, igual
            que Panel del turno arriba. Sin "Servir" (no hay estado real de
            "listo para servir" distinto de "enviado") ni "Reservas" (no
            existe esa feature en la app). */}
        {grupos.length > 0 && (ordenesActivas.cocina > 0 || ordenesActivas.cobro > 0) && (
          <div className="px-3 pt-5">
            <div className="flex items-center justify-between">
              <p className={texto.encabezadoSeccion}>Órdenes activas</p>
              <button
                onClick={() => router.push('/pedidos')}
                className="text-[13px] font-semibold text-[#173F2E] active:opacity-60"
              >
                Ver todas
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {ordenesActivas.cocina > 0 && (
                <button
                  onClick={() => router.push('/pedidos?filtro=cocina')}
                  className="flex items-center gap-3 rounded-xl bg-white p-3 text-left shadow-card transition-transform active:scale-[.98]"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <ChefHat size={18} strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-none">{ordenesActivas.cocina}</p>
                    <p className={`${texto.caption} mt-0.5`}>Cocina</p>
                  </div>
                </button>
              )}
              {ordenesActivas.cobro > 0 && (
                <button
                  onClick={() => router.push('/pedidos?filtro=cobro')}
                  className="flex items-center gap-3 rounded-xl bg-white p-3 text-left shadow-card transition-transform active:scale-[.98]"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <CreditCard size={18} strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-none">{ordenesActivas.cobro}</p>
                    <p className={`${texto.caption} mt-0.5`}>Cobro</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

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

      {/* Campana de notificaciones centralizada — alertas del sistema, aparte
          del semáforo de mesa (que se queda solo en el mapa/lista). */}
      <SheetNotificaciones
        open={notificacionesOpen}
        onClose={() => setNotificacionesOpen(false)}
        alertaVentasBajas={alertaVentasBajas}
        alertasPrecuenta={alertasPrecuenta}
      />

      {/* Turno desplegable — solo se monta si es Admin (esAdmin ya controla
          si onTurnoClick existe en HeaderA para siquiera poder abrirlo). */}
      {esAdmin && (
        <SheetTurnos
          open={sheetTurnosOpen}
          onClose={() => setSheetTurnosOpen(false)}
          turnosCerrados={turnosCerrados}
          turnoActivoId={turnoId}
        />
      )}
    </>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  tintBg = 'bg-[#173F2E]/10',
  tintText = 'text-[#173F2E]',
  valueClass = 'text-text',
}: {
  icon: LucideIcon
  label: string
  value: string
  tintBg?: string
  tintText?: string
  valueClass?: string
}) {
  return (
    <div className="flex w-[78px] flex-shrink-0 flex-col items-center gap-1 px-1 text-center">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tintBg} ${tintText}`}>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span className={`${texto.caption} leading-tight`}>{label}</span>
      <span className={`text-[13px] font-bold leading-none ${valueClass}`}>{value}</span>
    </div>
  )
}
