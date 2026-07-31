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
} from '@/app/(app)/mas/permisos/actions'
import type { ConfigPermisos } from '@/app/(app)/mas/permisos/page'

type ModoOrden = 'alfabetico_asc' | 'alfabetico_desc' | 'personalizado'

const OPCIONES_ORDEN: { value: ModoOrden; label: string }[] = [
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'alfabetico_asc', label: 'A → Z' },
  { value: 'alfabetico_desc', label: 'Z → A' },
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
]

interface PermisosShellProps {
  config: ConfigPermisos
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

export function PermisosShell({ config }: PermisosShellProps) {
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
  const [ordenModificadores, setOrdenModificadores] = useState<ModoOrden>(config.orden_modificadores)
  const [ordenBanner, setOrdenBanner] = useState<string | null>(null)

  // Alerta de mesa sin atender
  const [alertaMin, setAlertaMin] = useState(config.alerta_mesa_sin_atender_minutos.toString())
  const [savingAlerta, setSavingAlerta] = useState(false)
  const [alertaBanner, setAlertaBanner] = useState<string | null>(null)

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

  async function handleCambiarOrdenModificadores(modo: ModoOrden) {
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
                {OPCIONES_ORDEN.map((o) => (
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
            </div>
            <p className="text-xs text-text-3">
              &quot;Personalizado&quot; usa el orden que arrastras a mano en Catálogo. Los modos
              alfabéticos lo ignoran.
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
