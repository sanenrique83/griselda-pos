'use client'

import { useState, useTransition } from 'react'
import { BotonRegresarMas } from '@/components/layout/BotonRegresarMas'
import {
  actualizarPermiso,
  actualizarBanco,
  actualizarPropina,
  actualizarTimeoutInactividad,
  actualizarOrdenProductos,
  actualizarOrdenModificadores,
  actualizarAlertaMesaMinutos,
  actualizarModificadoresPorLinea,
  actualizarTiempoMesaAlerta,
  actualizarAlertaVentasBajasUmbral,
  actualizarTurnoDiferenciaAlerta,
  actualizarAlertaPrecuentaMinutos,
  actualizarOrdenPopularidadDias,
  actualizarFormatoModificadoresTicket,
  actualizarRecordatorioFinTurnoMinutos,
} from '@/app/(app)/mas/permisos/actions'
import type { ConfigPermisos } from '@/app/(app)/mas/permisos/page'
import type { ModoOrden, ModoOrdenModificadores } from '@/lib/ordenCatalogo'
import type { TurnoHorario } from '@/lib/types/database.types'
import { SeccionTurnosHorario } from './SeccionTurnosHorario'

const OPCIONES_ORDEN: { value: ModoOrden; label: string }[] = [
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'alfabetico_asc', label: 'A → Z' },
  { value: 'alfabetico_desc', label: 'Z → A' },
]

// Solo para el selector de modificadores — orden_productos nunca acepta
// 'popularidad' (ver CHECK constraint de config_sistema).
const OPCIONES_ORDEN_MODIFICADORES: { value: ModoOrdenModificadores; label: string }[] = [
  ...OPCIONES_ORDEN,
  { value: 'popularidad', label: 'Popularidad' },
]

type FormatoModificadoresTicket = ConfigPermisos['formato_modificadores_ticket']

const OPCIONES_FORMATO_MODIFICADORES: { value: FormatoModificadoresTicket; label: string }[] = [
  { value: 'agrupado', label: 'Agrupado' },
  { value: 'lista', label: 'Lista' },
  { value: 'texto_natural', label: 'Texto natural' },
]

const PERMISOS_MESERO: { campo: keyof ConfigPermisos; label: string; desc: string }[] = [
  {
    campo: 'cancelaciones_mesero',
    label: 'Cancelar ítems',
    desc: 'El mesero puede cancelar productos de una comanda',
  },
  {
    campo: 'descuentos_mesero',
    label: 'Aplicar descuentos',
    desc: 'El mesero puede aplicar descuentos a pedidos',
  },
  {
    campo: 'cancelar_pedido_mesero',
    label: 'Anular mesa completa',
    desc: 'El mesero puede anular un pedido completo sin cobrar',
  },
  {
    campo: 'ver_dashboard_mesero',
    label: 'Ver Dashboard',
    desc: 'El mesero puede ver las métricas del turno',
  },
  {
    campo: 'panel_turno_mesero_financiero',
    label: 'Ver panel financiero en Mesas',
    desc: 'El mesero ve Ticket promedio y Cobro pendiente en el Panel del turno de /mesas (siempre visibles para Admin)',
  },
]

interface PermisosShellProps {
  config: ConfigPermisos
  turnosHorario: TurnoHorario[]
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  desc,
  value,
  onChange,
  disabled,
}: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#F2F2F7] last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-[14px] font-medium leading-tight">{label}</p>
        <p className="text-[12px] text-text-3 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`relative flex-shrink-0 h-[28px] w-[50px] rounded-full transition-colors duration-200 disabled:opacity-40 ${
          value ? 'bg-blue-600' : 'bg-[#D1D1D6]'
        }`}
      >
        <span
          className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-200 ${
            value ? 'translate-x-[23px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </div>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PermisosShell({ config, turnosHorario }: PermisosShellProps) {
  const [permisos, setPermisos] = useState<ConfigPermisos>(config)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Banco
  const [banco, setBanco] = useState(config.transferencia_banco ?? '')
  const [clabe, setClabe] = useState(config.transferencia_clabe ?? '')
  const [titular, setTitular] = useState(config.transferencia_titular ?? '')
  const [savingBanco, setSavingBanco] = useState(false)
  const [bancoBanner, setBancoBanner] = useState<string | null>(null)

  // Propina
  const [propinaPct, setPropinaPct] = useState(config.propina_sugerida_pct.toString())
  const [savingPropina, setSavingPropina] = useState(false)
  const [propinaBanner, setPropinaBanner] = useState<string | null>(null)

  // Cierre de sesión por inactividad
  const [timeoutMin, setTimeoutMin] = useState(config.timeout_inactividad_minutos.toString())
  const [savingTimeout, setSavingTimeout] = useState(false)
  const [timeoutBanner, setTimeoutBanner] = useState<string | null>(null)

  // Orden del catálogo
  const [ordenProductos, setOrdenProductos] = useState<ModoOrden>(config.orden_productos)
  const [ordenModificadores, setOrdenModificadores] = useState<ModoOrdenModificadores>(config.orden_modificadores)
  const [ordenBanner, setOrdenBanner] = useState<string | null>(null)

  // Días considerados por el modo 'popularidad' de orden_modificadores
  const [popularidadDias, setPopularidadDias] = useState(config.orden_popularidad_dias.toString())
  const [savingPopularidadDias, setSavingPopularidadDias] = useState(false)
  const [popularidadDiasBanner, setPopularidadDiasBanner] = useState<string | null>(null)

  // Alerta de mesa sin atender
  const [alertaMin, setAlertaMin] = useState(config.alerta_mesa_sin_atender_minutos.toString())
  const [savingAlerta, setSavingAlerta] = useState(false)
  const [alertaBanner, setAlertaBanner] = useState<string | null>(null)

  // Modificadores por línea en tickets impresos
  const [modsPorLinea, setModsPorLinea] = useState(config.modificadores_por_linea.toString())
  const [savingModsPorLinea, setSavingModsPorLinea] = useState(false)
  const [modsPorLineaBanner, setModsPorLineaBanner] = useState<string | null>(null)

  // Formato de modificadores en tickets impresos ('lista'/'agrupado' ya
  // existían, gobernados por modificadores_por_linea; 'texto_natural' arma
  // una frase — ver lib/descripcionNatural.ts)
  const [formatoMods, setFormatoMods] = useState<FormatoModificadoresTicket>(config.formato_modificadores_ticket)
  const [formatoModsBanner, setFormatoModsBanner] = useState<string | null>(null)

  // Temporizador de mesa en vivo (F9-03)
  const [tiempoMesaMin, setTiempoMesaMin] = useState(config.tiempo_mesa_alerta_minutos.toString())
  const [savingTiempoMesa, setSavingTiempoMesa] = useState(false)
  const [tiempoMesaBanner, setTiempoMesaBanner] = useState<string | null>(null)

  // Alerta de ventas bajas en tiempo real (F9-06)
  const [ventasBajasPct, setVentasBajasPct] = useState(config.alerta_ventas_bajas_umbral_pct.toString())
  const [savingVentasBajas, setSavingVentasBajas] = useState(false)
  const [ventasBajasBanner, setVentasBajasBanner] = useState<string | null>(null)

  // Umbral de diferencia de efectivo al cerrar turno
  const [turnoDiferenciaMonto, setTurnoDiferenciaMonto] = useState(
    config.turno_diferencia_alerta_monto.toString(),
  )
  const [savingTurnoDiferencia, setSavingTurnoDiferencia] = useState(false)
  const [turnoDiferenciaBanner, setTurnoDiferenciaBanner] = useState<string | null>(null)

  // Recordatorio proactivo de fin de turno programado (no es la validación
  // de cierre de arriba — ver turnos_horario/abrirTurno())
  const [recordatorioFinTurnoMin, setRecordatorioFinTurnoMin] = useState(
    config.recordatorio_fin_turno_minutos.toString(),
  )
  const [savingRecordatorioFinTurno, setSavingRecordatorioFinTurno] = useState(false)
  const [recordatorioFinTurnoBanner, setRecordatorioFinTurnoBanner] = useState<string | null>(null)

  // Alerta de precuenta impresa hace tiempo sin cobrar
  const [precuentaMin, setPrecuentaMin] = useState(config.alerta_precuenta_minutos.toString())
  const [savingPrecuenta, setSavingPrecuenta] = useState(false)
  const [precuentaBanner, setPrecuentaBanner] = useState<string | null>(null)

  function handleToggle(campo: keyof ConfigPermisos, valor: boolean) {
    // Optimistic update
    setPermisos((prev) => ({ ...prev, [campo]: valor }))
    setError(null)
    startTransition(async () => {
      const result = await actualizarPermiso(campo as string, valor)
      if (result?.error) {
        // Rollback
        setPermisos((prev) => ({ ...prev, [campo]: !valor }))
        setError(result.error)
      }
    })
  }

  async function handleGuardarBanco() {
    setSavingBanco(true)
    setBancoBanner(null)
    const result = await actualizarBanco({
      transferencia_banco: banco.trim() || null,
      transferencia_clabe: clabe.trim() || null,
      transferencia_titular: titular.trim() || null,
    })
    setSavingBanco(false)
    if (result?.error) {
      setBancoBanner(result.error)
    } else {
      setBancoBanner('Guardado ✓')
      setTimeout(() => setBancoBanner(null), 3000)
    }
  }

  async function handleGuardarPropina() {
    const pct = parseFloat(propinaPct)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setPropinaBanner('Ingresa un porcentaje entre 0 y 100.')
      return
    }
    setSavingPropina(true)
    setPropinaBanner(null)
    const result = await actualizarPropina(pct)
    setSavingPropina(false)
    if (result?.error) {
      setPropinaBanner(result.error)
    } else {
      setPropinaBanner('Guardado ✓')
      setTimeout(() => setPropinaBanner(null), 3000)
    }
  }

  async function handleGuardarTimeout() {
    const minutos = parseInt(timeoutMin, 10)
    if (isNaN(minutos) || minutos < 0) {
      setTimeoutBanner('Ingresa un número de minutos válido (0 o más).')
      return
    }
    setSavingTimeout(true)
    setTimeoutBanner(null)
    const result = await actualizarTimeoutInactividad(minutos)
    setSavingTimeout(false)
    if (result?.error) {
      setTimeoutBanner(result.error)
    } else {
      setTimeoutBanner('Guardado ✓')
      setTimeout(() => setTimeoutBanner(null), 3000)
    }
  }

  async function handleGuardarAlertaMinutos() {
    const minutos = parseInt(alertaMin, 10)
    if (isNaN(minutos) || minutos < 0) {
      setAlertaBanner('Ingresa un número de minutos válido (0 o más).')
      return
    }
    setSavingAlerta(true)
    setAlertaBanner(null)
    const result = await actualizarAlertaMesaMinutos(minutos)
    setSavingAlerta(false)
    if (result?.error) {
      setAlertaBanner(result.error)
    } else {
      setAlertaBanner('Guardado ✓')
      setTimeout(() => setAlertaBanner(null), 3000)
    }
  }

  async function handleGuardarModsPorLinea() {
    const cantidad = parseInt(modsPorLinea, 10)
    if (isNaN(cantidad) || cantidad < 1) {
      setModsPorLineaBanner('Ingresa un número de 1 o más.')
      return
    }
    setSavingModsPorLinea(true)
    setModsPorLineaBanner(null)
    const result = await actualizarModificadoresPorLinea(cantidad)
    setSavingModsPorLinea(false)
    if (result?.error) {
      setModsPorLineaBanner(result.error)
    } else {
      setModsPorLineaBanner('Guardado ✓')
      setTimeout(() => setModsPorLineaBanner(null), 3000)
    }
  }

  async function handleCambiarFormatoMods(formato: FormatoModificadoresTicket) {
    const anterior = formatoMods
    setFormatoMods(formato)
    setFormatoModsBanner(null)
    const result = await actualizarFormatoModificadoresTicket(formato)
    if (result?.error) {
      setFormatoMods(anterior)
      setFormatoModsBanner(result.error)
    } else {
      setFormatoModsBanner('Guardado ✓')
      setTimeout(() => setFormatoModsBanner(null), 3000)
    }
  }

  async function handleGuardarTiempoMesa() {
    const minutos = parseInt(tiempoMesaMin, 10)
    if (isNaN(minutos) || minutos < 1) {
      setTiempoMesaBanner('Ingresa un número de minutos válido (1 o más).')
      return
    }
    setSavingTiempoMesa(true)
    setTiempoMesaBanner(null)
    const result = await actualizarTiempoMesaAlerta(minutos)
    setSavingTiempoMesa(false)
    if (result?.error) {
      setTiempoMesaBanner(result.error)
    } else {
      setTiempoMesaBanner('Guardado ✓')
      setTimeout(() => setTiempoMesaBanner(null), 3000)
    }
  }

  async function handleGuardarVentasBajasUmbral() {
    const pct = parseInt(ventasBajasPct, 10)
    if (isNaN(pct) || pct < 1 || pct > 100) {
      setVentasBajasBanner('Ingresa un porcentaje entre 1 y 100.')
      return
    }
    setSavingVentasBajas(true)
    setVentasBajasBanner(null)
    const result = await actualizarAlertaVentasBajasUmbral(pct)
    setSavingVentasBajas(false)
    if (result?.error) {
      setVentasBajasBanner(result.error)
    } else {
      setVentasBajasBanner('Guardado ✓')
      setTimeout(() => setVentasBajasBanner(null), 3000)
    }
  }

  async function handleGuardarTurnoDiferencia() {
    const monto = parseFloat(turnoDiferenciaMonto)
    if (isNaN(monto) || monto < 0) {
      setTurnoDiferenciaBanner('Ingresa un monto válido (0 o más).')
      return
    }
    setSavingTurnoDiferencia(true)
    setTurnoDiferenciaBanner(null)
    const result = await actualizarTurnoDiferenciaAlerta(monto)
    setSavingTurnoDiferencia(false)
    if (result?.error) {
      setTurnoDiferenciaBanner(result.error)
    } else {
      setTurnoDiferenciaBanner('Guardado ✓')
      setTimeout(() => setTurnoDiferenciaBanner(null), 3000)
    }
  }

  async function handleGuardarRecordatorioFinTurno() {
    const minutos = parseInt(recordatorioFinTurnoMin, 10)
    if (isNaN(minutos) || minutos < 1) {
      setRecordatorioFinTurnoBanner('Ingresa un número de minutos válido (1 o más).')
      return
    }
    setSavingRecordatorioFinTurno(true)
    setRecordatorioFinTurnoBanner(null)
    const result = await actualizarRecordatorioFinTurnoMinutos(minutos)
    setSavingRecordatorioFinTurno(false)
    if (result?.error) {
      setRecordatorioFinTurnoBanner(result.error)
    } else {
      setRecordatorioFinTurnoBanner('Guardado ✓')
      setTimeout(() => setRecordatorioFinTurnoBanner(null), 3000)
    }
  }

  async function handleGuardarPrecuentaMinutos() {
    const minutos = parseInt(precuentaMin, 10)
    if (isNaN(minutos) || minutos < 1) {
      setPrecuentaBanner('Ingresa un número de minutos válido (1 o más).')
      return
    }
    setSavingPrecuenta(true)
    setPrecuentaBanner(null)
    const result = await actualizarAlertaPrecuentaMinutos(minutos)
    setSavingPrecuenta(false)
    if (result?.error) {
      setPrecuentaBanner(result.error)
    } else {
      setPrecuentaBanner('Guardado ✓')
      setTimeout(() => setPrecuentaBanner(null), 3000)
    }
  }

  async function handleCambiarOrdenProductos(modo: ModoOrden) {
    const anterior = ordenProductos
    setOrdenProductos(modo)
    setOrdenBanner(null)
    const result = await actualizarOrdenProductos(modo)
    if (result?.error) {
      setOrdenProductos(anterior)
      setOrdenBanner(result.error)
    } else {
      setOrdenBanner('Guardado ✓')
      setTimeout(() => setOrdenBanner(null), 3000)
    }
  }

  async function handleCambiarOrdenModificadores(modo: ModoOrdenModificadores) {
    const anterior = ordenModificadores
    setOrdenModificadores(modo)
    setOrdenBanner(null)
    const result = await actualizarOrdenModificadores(modo)
    if (result?.error) {
      setOrdenModificadores(anterior)
      setOrdenBanner(result.error)
    } else {
      setOrdenBanner('Guardado ✓')
      setTimeout(() => setOrdenBanner(null), 3000)
    }
  }

  async function handleGuardarPopularidadDias() {
    const dias = parseInt(popularidadDias, 10)
    if (isNaN(dias) || dias < 1) {
      setPopularidadDiasBanner('Ingresa un número de días válido (1 o más).')
      return
    }
    setSavingPopularidadDias(true)
    setPopularidadDiasBanner(null)
    const result = await actualizarOrdenPopularidadDias(dias)
    setSavingPopularidadDias(false)
    if (result?.error) {
      setPopularidadDiasBanner(result.error)
    } else {
      setPopularidadDiasBanner('Guardado ✓')
      setTimeout(() => setPopularidadDiasBanner(null), 3000)
    }
  }

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <BotonRegresarMas />
        <h1 className="mt-1 text-[20px] font-bold leading-tight">Permisos y config.</h1>
      </div>

      <div className="px-4 py-4 space-y-5">

        {/* Error global */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ── Permisos mesero ──────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Permisos del mesero
            </p>
          </div>
          {PERMISOS_MESERO.map((p) => (
            <ToggleRow
              key={p.campo}
              label={p.label}
              desc={p.desc}
              value={permisos[p.campo] as boolean}
              onChange={(v) => handleToggle(p.campo, v)}
              disabled={isPending}
            />
          ))}
        </div>

        {/* ── Datos de transferencia ────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Datos para transferencia
            </p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Banco
              </label>
              <input
                type="text"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ej: BBVA"
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                CLABE
              </label>
              <input
                type="text"
                value={clabe}
                onChange={(e) => setClabe(e.target.value)}
                placeholder="18 dígitos"
                maxLength={18}
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 font-mono text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Titular
              </label>
              <input
                type="text"
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                placeholder="Nombre completo"
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            {bancoBanner && (
              <p className={`text-xs font-semibold ${bancoBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {bancoBanner}
              </p>
            )}
            <button
              onClick={handleGuardarBanco}
              disabled={savingBanco}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingBanco ? 'Guardando…' : 'Guardar datos bancarios'}
            </button>
          </div>
        </div>

        {/* ── Propina sugerida ─────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Propina sugerida
            </p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={1}
                value={propinaPct}
                onChange={(e) => setPropinaPct(e.target.value)}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500"
              />
              <p className="text-sm text-text-2">% sobre el total del pedido</p>
            </div>
            <p className="text-xs text-text-3">
              Aparece como opción al cobrar. Usa 0 para desactivar.
            </p>
            {propinaBanner && (
              <p className={`text-xs font-semibold ${propinaBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {propinaBanner}
              </p>
            )}
            <button
              onClick={handleGuardarPropina}
              disabled={savingPropina}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingPropina ? 'Guardando…' : 'Guardar propina'}
            </button>
          </div>
        </div>

        {/* ── Cierre de sesión por inactividad ─────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Sesión
            </p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Cerrar sesión por inactividad (minutos)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={timeoutMin}
                onChange={(e) => setTimeoutMin(e.target.value)}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-text-3">
              Sin actividad (clics, toques o teclas) durante este tiempo, la sesión se cierra
              automáticamente. Usa 0 para desactivarlo.
            </p>
            {timeoutBanner && (
              <p className={`text-xs font-semibold ${timeoutBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {timeoutBanner}
              </p>
            )}
            <button
              onClick={handleGuardarTimeout}
              disabled={savingTimeout}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingTimeout ? 'Guardando…' : 'Guardar tiempo de inactividad'}
            </button>
          </div>
        </div>

        {/* ── Alerta de mesa sin atender ───────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Alerta de mesa sin atender
            </p>
          </div>
          <ToggleRow
            label="Mostrar alerta roja"
            desc="Resalta en rojo una mesa con pedido abierto que lleva rato sin captura"
            value={permisos.alerta_mesa_sin_atender}
            onChange={(v) => handleToggle('alerta_mesa_sin_atender', v)}
            disabled={isPending}
          />
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Minutos sin productos capturados
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={alertaMin}
                onChange={(e) => setAlertaMin(e.target.value)}
                disabled={!permisos.alerta_mesa_sin_atender}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </div>
            <p className="text-xs text-text-3">
              Una mesa con pedido abierto pero sin ningún producto pendiente o enviado se marca en
              rojo al pasar este tiempo desde que se abrió.
            </p>
            {alertaBanner && (
              <p className={`text-xs font-semibold ${alertaBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {alertaBanner}
              </p>
            )}
            <button
              onClick={handleGuardarAlertaMinutos}
              disabled={savingAlerta || !permisos.alerta_mesa_sin_atender}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingAlerta ? 'Guardando…' : 'Guardar minutos de alerta'}
            </button>
          </div>
        </div>

        {/* ── Alerta de ventas bajas en tiempo real (F9-06) ─────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Alerta de ventas bajas
            </p>
          </div>
          <ToggleRow
            label="Mostrar aviso"
            desc="Avisa en Dashboard (y en /mesas a los admin) si las ventas del turno van muy por debajo de lo normal para esta hora"
            value={permisos.alerta_ventas_bajas_activa}
            onChange={(v) => handleToggle('alerta_ventas_bajas_activa', v)}
            disabled={isPending}
          />
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                % de desviación hacia abajo que dispara la alerta
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={ventasBajasPct}
                onChange={(e) => setVentasBajasPct(e.target.value)}
                disabled={!permisos.alerta_ventas_bajas_activa}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </div>
            <p className="text-xs text-text-3">
              Compara lo cobrado en el turno activo hasta ahora contra el promedio de los últimos
              turnos del mismo día de la semana a esta misma hora. Es una señal de que algo puede
              estar mal en este momento — no tiene relación con la predicción de demanda de mañana.
            </p>
            {ventasBajasBanner && (
              <p className={`text-xs font-semibold ${ventasBajasBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {ventasBajasBanner}
              </p>
            )}
            <button
              onClick={handleGuardarVentasBajasUmbral}
              disabled={savingVentasBajas || !permisos.alerta_ventas_bajas_activa}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingVentasBajas ? 'Guardando…' : 'Guardar umbral de alerta'}
            </button>
          </div>
        </div>

        {/* ── Diferencia de efectivo al cerrar turno ────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Diferencia de efectivo al cerrar turno
            </p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Monto de diferencia que dispara la advertencia
              </label>
              <div className="relative w-32">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-text-3">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={turnoDiferenciaMonto}
                  onChange={(e) => setTurnoDiferenciaMonto(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 py-3 pl-7 pr-3.5 text-center font-mono text-lg font-bold outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-text-3">
              Si el efectivo contado difiere del teórico por más de este monto (de sobra o de
              faltante), la pantalla de cierre de turno pide una segunda confirmación explícita
              antes de proceder — no bloquea el cierre, solo avisa.
            </p>
            {turnoDiferenciaBanner && (
              <p className={`text-xs font-semibold ${turnoDiferenciaBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {turnoDiferenciaBanner}
              </p>
            )}
            <button
              onClick={handleGuardarTurnoDiferencia}
              disabled={savingTurnoDiferencia}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingTurnoDiferencia ? 'Guardando…' : 'Guardar umbral de diferencia'}
            </button>
          </div>
        </div>

        {/* ── Patrones de turno (para el recordatorio de fin de turno) ──────── */}
        <SeccionTurnosHorario turnosHorario={turnosHorario} />

        {/* ── Recordatorio de fin de turno programado ────────────────────────
            Distinto de "Diferencia de efectivo al cerrar turno" de arriba —
            ese valida el cierre, esto es un aviso ANTES de llegar a la hora
            fin, sin bloquear nada. */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Recordatorio de fin de turno
            </p>
          </div>
          <ToggleRow
            label="Mostrar aviso"
            desc="Avisa en /mas/turno cuando falte poco para la hora fin del patrón de turno emparejado al abrir"
            value={permisos.recordatorio_fin_turno_activo}
            onChange={(v) => handleToggle('recordatorio_fin_turno_activo', v)}
            disabled={isPending}
          />
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Minutos antes de la hora fin
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={recordatorioFinTurnoMin}
                onChange={(e) => setRecordatorioFinTurnoMin(e.target.value)}
                disabled={!permisos.recordatorio_fin_turno_activo}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </div>
            <p className="text-xs text-text-3">
              Solo aplica si el turno abierto quedó emparejado con un patrón (ver "Patrones de
              turno" arriba) — sin coincidencia clara al abrir, no hay recordatorio que mostrar.
            </p>
            {recordatorioFinTurnoBanner && (
              <p className={`text-xs font-semibold ${recordatorioFinTurnoBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {recordatorioFinTurnoBanner}
              </p>
            )}
            <button
              onClick={handleGuardarRecordatorioFinTurno}
              disabled={savingRecordatorioFinTurno || !permisos.recordatorio_fin_turno_activo}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingRecordatorioFinTurno ? 'Guardando…' : 'Guardar minutos del recordatorio'}
            </button>
          </div>
        </div>

        {/* ── Alerta de precuenta impresa hace tiempo sin cobrar ─────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Alerta de precuenta
            </p>
          </div>
          <ToggleRow
            label="Mostrar aviso"
            desc="Marca la mesa en /mesas y /mas/mapa-mesas si se imprimió la precuenta y aún no se ha cobrado, pasado el tiempo configurado"
            value={permisos.alerta_precuenta_activa}
            onChange={(v) => handleToggle('alerta_precuenta_activa', v)}
            disabled={isPending}
          />
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Minutos desde la precuenta que disparan el aviso
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={precuentaMin}
                onChange={(e) => setPrecuentaMin(e.target.value)}
                disabled={!permisos.alerta_precuenta_activa}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </div>
            <p className="text-xs text-text-3">
              El aviso (🧾 hace X min) es independiente del semáforo de color de la mesa — se
              limpia solo en cuanto se registra cualquier cobro real sobre ese pedido.
            </p>
            {precuentaBanner && (
              <p className={`text-xs font-semibold ${precuentaBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {precuentaBanner}
              </p>
            )}
            <button
              onClick={handleGuardarPrecuentaMinutos}
              disabled={savingPrecuenta || !permisos.alerta_precuenta_activa}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingPrecuenta ? 'Guardando…' : 'Guardar minutos de alerta'}
            </button>
          </div>
        </div>

        {/* ── Temporizador de mesa en vivo (F9-03) ──────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Temporizador de mesa
            </p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Minutos para alerta ámbar/roja
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={tiempoMesaMin}
                onChange={(e) => setTiempoMesaMin(e.target.value)}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-text-3">
              El tiempo transcurrido desde que se abrió el pedido, que se muestra junto a cada mesa
              ocupada en /mesas y el mapa de mesas, se colorea en ámbar al llegar a este umbral y en
              rojo a partir de 1.5x. Independiente del semáforo de color de la mesa.
            </p>
            {tiempoMesaBanner && (
              <p className={`text-xs font-semibold ${tiempoMesaBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {tiempoMesaBanner}
              </p>
            )}
            <button
              onClick={handleGuardarTiempoMesa}
              disabled={savingTiempoMesa}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingTiempoMesa ? 'Guardando…' : 'Guardar umbral de temporizador'}
            </button>
          </div>
        </div>

        {/* ── Modificadores por línea en tickets impresos ──────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Tickets impresos
            </p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Formato de modificadores
              </label>
              <div className="flex gap-1.5">
                {OPCIONES_FORMATO_MODIFICADORES.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => handleCambiarFormatoMods(o.value)}
                    className={`flex-1 rounded-lg px-2 py-2.5 text-[12px] font-semibold transition-colors ${
                      formatoMods === o.value ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-text-3">
              &quot;Agrupado&quot; y &quot;Lista&quot; usan los modificadores por línea de abajo.
              &quot;Texto natural&quot; arma una frase (ej. &quot;Menudo Chico de Pedacito con Libro
              y Pata&quot;) configurada por grupo en Catálogo → Productos → editar grupo.
            </p>
            {formatoModsBanner && (
              <p className={`text-xs font-semibold ${formatoModsBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {formatoModsBanner}
              </p>
            )}
            <div className="border-t border-[#F2F2F7] pt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Modificadores por línea
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={modsPorLinea}
                onChange={(e) => setModsPorLinea(e.target.value)}
                className="w-24 rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-center font-mono text-lg font-bold outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-text-3">
              Cuántos modificadores caben en una sola línea del ticket (cocina y cliente), unidos
              con &quot;+&quot; — ahorra papel cuando hay muchos. Usa 1 para uno por línea.
            </p>
            {modsPorLineaBanner && (
              <p className={`text-xs font-semibold ${modsPorLineaBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {modsPorLineaBanner}
              </p>
            )}
            <button
              onClick={handleGuardarModsPorLinea}
              disabled={savingModsPorLinea}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
            >
              {savingModsPorLinea ? 'Guardando…' : 'Guardar modificadores por línea'}
            </button>
          </div>
        </div>

        {/* ── Orden del catálogo ────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Orden del catálogo
            </p>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Productos (menú del POS y Catálogo)
              </label>
              <div className="flex gap-1.5">
                {OPCIONES_ORDEN.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => handleCambiarOrdenProductos(o.value)}
                    className={`flex-1 rounded-lg px-2 py-2.5 text-[12px] font-semibold transition-colors ${
                      ordenProductos === o.value ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Opciones de modificadores
              </label>
              <div className="flex gap-1.5">
                {OPCIONES_ORDEN_MODIFICADORES.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => handleCambiarOrdenModificadores(o.value)}
                    className={`flex-1 rounded-lg px-2 py-2.5 text-[12px] font-semibold transition-colors ${
                      ordenModificadores === o.value ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {ordenModificadores === 'popularidad' && (
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span className="text-xs text-text-3">Considerando los últimos</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={popularidadDias}
                    onChange={(e) => setPopularidadDias(e.target.value)}
                    className="w-16 rounded-lg border-[1.5px] border-border bg-s2 px-2 py-1.5 text-center font-mono text-sm font-bold outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-text-3">días</span>
                  <button
                    onClick={handleGuardarPopularidadDias}
                    disabled={savingPopularidadDias}
                    className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white active:opacity-80 disabled:opacity-40"
                  >
                    {savingPopularidadDias ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              )}
              {popularidadDiasBanner && (
                <p className={`mt-1.5 text-xs font-semibold ${popularidadDiasBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                  {popularidadDiasBanner}
                </p>
              )}
            </div>
            <p className="text-xs text-text-3">
              &quot;Personalizado&quot; usa el orden que arrastras a mano en Catálogo. Los modos
              alfabéticos lo ignoran. &quot;Popularidad&quot; ordena por veces elegida en los
              últimos días configurados — calculado al vuelo solo en el menú del POS; el editor
              de Catálogo se queda con el orden personalizado mientras se edita.
            </p>
            {ordenBanner && (
              <p className={`text-xs font-semibold ${ordenBanner.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {ordenBanner}
              </p>
            )}
          </div>
        </div>

        <div className="h-2" />
      </div>
    </div>
  )
}
