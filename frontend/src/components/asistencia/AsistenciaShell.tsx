'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderB } from '@/components/ui/HeaderB'
import {
  marcarEntrada,
  marcarSalida,
  obtenerHistorialAsistencia,
  exportarAsistenciaCSV,
} from '@/app/(app)/mas/asistencia/actions'
import type { AsistenciaRow, AsistenciaFiltros, UsuarioOpcion } from '@/app/(app)/mas/asistencia/page'

function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

function fmtDuracion(entrada: string, salida: string | null) {
  if (!salida) return 'En curso'
  const minutos = (new Date(salida).getTime() - new Date(entrada).getTime()) / 60000
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}

function descargarCSV(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `asistencia_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface AsistenciaShellProps {
  isAdmin: boolean
  entradaAbiertaEn: string | null
  historialInicial: AsistenciaRow[]
  usuariosOpciones: UsuarioOpcion[]
  filtrosIniciales: AsistenciaFiltros
}

export function AsistenciaShell({
  isAdmin,
  entradaAbiertaEn,
  historialInicial,
  usuariosOpciones,
  filtrosIniciales,
}: AsistenciaShellProps) {
  const router = useRouter()
  const [entradaAbierta, setEntradaAbierta] = useState(entradaAbiertaEn)
  const [isPendingMarcar, startMarcarTransition] = useTransition()
  const [errorMarcar, setErrorMarcar] = useState<string | null>(null)

  function handleMarcar() {
    setErrorMarcar(null)
    startMarcarTransition(async () => {
      const result = entradaAbierta ? await marcarSalida() : await marcarEntrada()
      if (result?.error) {
        setErrorMarcar(result.error)
        return
      }
      setEntradaAbierta(entradaAbierta ? null : new Date().toISOString())
    })
  }

  return (
    <div className="min-h-full bg-s2">
      <HeaderB backLabel="Más" onBack={() => router.push('/mas')} titulo="Asistencia" />

      <div className="px-4 py-4 space-y-4">
        {/* ── Marcar entrada / salida (propia) ────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card px-4 py-5 text-center">
          {entradaAbierta ? (
            <>
              <p className="text-[13px] text-text-3">Entrada marcada</p>
              <p className="mt-1 font-mono text-[22px] font-bold text-[#173F2E]">
                {fmtHora(entradaAbierta)}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-text-3">Sin entrada activa</p>
          )}
          {errorMarcar && (
            <p className="mt-2 text-xs font-semibold text-red-600">{errorMarcar}</p>
          )}
          <button
            onClick={handleMarcar}
            disabled={isPendingMarcar}
            className={`mt-4 w-full rounded-xl py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(0,0,0,.15)] active:scale-[.98] disabled:opacity-40 ${
              entradaAbierta ? 'bg-red-600' : 'bg-[#173F2E]'
            }`}
          >
            {isPendingMarcar ? 'Guardando…' : entradaAbierta ? 'Marcar salida' : 'Marcar entrada'}
          </button>
        </div>

        {isAdmin && (
          <HistorialAdmin
            historialInicial={historialInicial}
            usuariosOpciones={usuariosOpciones}
            filtrosIniciales={filtrosIniciales}
          />
        )}

        <div className="h-2" />
      </div>
    </div>
  )
}

// ─── Historial + export CSV (admin) ────────────────────────────────────────

function HistorialAdmin({
  historialInicial,
  usuariosOpciones,
  filtrosIniciales,
}: {
  historialInicial: AsistenciaRow[]
  usuariosOpciones: UsuarioOpcion[]
  filtrosIniciales: AsistenciaFiltros
}) {
  const [historial, setHistorial] = useState(historialInicial)
  const [usuarioId, setUsuarioId] = useState(filtrosIniciales.usuarioId ?? '')
  const [desde, setDesde] = useState(filtrosIniciales.desde)
  const [hasta, setHasta] = useState(filtrosIniciales.hasta)
  const [isPending, startTransition] = useTransition()
  const [isPendingCSV, startCSVTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function filtrosActuales(): AsistenciaFiltros {
    return { usuarioId: usuarioId || null, desde, hasta }
  }

  function handleFiltrar() {
    setError(null)
    startTransition(async () => {
      const result = await obtenerHistorialAsistencia(filtrosActuales())
      if ('error' in result) { setError(result.error); return }
      setHistorial(result)
    })
  }

  function handleExportar() {
    setError(null)
    startCSVTransition(async () => {
      const result = await exportarAsistenciaCSV(filtrosActuales())
      if ('error' in result) { setError(result.error); return }
      descargarCSV(result.csv)
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white shadow-card px-4 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Historial del personal
        </p>

        <select
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-2.5 py-2 text-[13px] outline-none focus:border-[#173F2E]"
        >
          <option value="">Todo el personal</option>
          {usuariosOpciones.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-2.5 py-2 text-[13px] outline-none focus:border-[#173F2E]"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-border bg-s2 px-2.5 py-2 text-[13px] outline-none focus:border-[#173F2E]"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <button
          onClick={handleFiltrar}
          disabled={isPending}
          className="w-full rounded-lg bg-s2 py-2.5 text-[13px] font-semibold text-text-2 active:opacity-70 disabled:opacity-40"
        >
          {isPending ? 'Filtrando…' : 'Aplicar filtro'}
        </button>
        <button
          onClick={handleExportar}
          disabled={isPendingCSV}
          className="w-full rounded-lg bg-[#173F2E] py-2.5 text-[13px] font-bold text-white active:opacity-80 disabled:opacity-40"
        >
          {isPendingCSV ? 'Generando…' : '⬇ Exportar CSV'}
        </button>
        <p className="text-[11px] text-text-4">
          El CSV incluye horas trabajadas, ventas y propina de cada período (entrada→salida),
          atribuidas al mesero dueño del pedido.
        </p>
      </div>

      {historial.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card px-4 py-10 text-center">
          <p className="text-sm text-text-3">Sin registros de asistencia en este rango.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card overflow-hidden divide-y divide-[#F2F2F7]">
          {historial.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.usuarioNombre}</p>
                <p className="mt-0.5 text-[11px] text-text-3">
                  {fmtFechaHora(a.entrada)} → {a.salida ? fmtFechaHora(a.salida) : 'en curso'}
                </p>
              </div>
              <span
                className={`flex-shrink-0 font-mono text-[12px] font-semibold ${
                  a.salida ? 'text-text-2' : 'text-[#173F2E]'
                }`}
              >
                {fmtDuracion(a.entrada, a.salida)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
