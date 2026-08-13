'use client'

import { useState, useTransition } from 'react'
import { crearTurnoHorario, actualizarTurnoHorario } from '@/app/(app)/mas/permisos/actions'
import type { TurnoHorario } from '@/lib/types/database.types'

interface SeccionTurnosHorarioProps {
  turnosHorario: TurnoHorario[]
}

type SheetMode = { tipo: 'none' } | { tipo: 'nuevo' } | { tipo: 'editar'; turno: TurnoHorario }

// 'HH:MM:SS' (columna TIME) → 'HH:MM' (<input type="time">) y viceversa.
function aInputTime(horaDb: string) {
  return horaDb.slice(0, 5)
}
function aHoraDb(horaInput: string) {
  return horaInput.length === 5 ? `${horaInput}:00` : horaInput
}

export function SeccionTurnosHorario({ turnosHorario: initial }: SeccionTurnosHorarioProps) {
  const [turnos, setTurnos] = useState(initial)
  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [formNombre, setFormNombre] = useState('')
  const [formHoraInicio, setFormHoraInicio] = useState('')
  const [formHoraFin, setFormHoraFin] = useState('')
  const [formActivo, setFormActivo] = useState(true)

  function abrirSheet(mode: SheetMode) {
    setFormError(null)
    if (mode.tipo === 'editar') {
      setFormNombre(mode.turno.nombre)
      setFormHoraInicio(aInputTime(mode.turno.hora_inicio))
      setFormHoraFin(aInputTime(mode.turno.hora_fin))
      setFormActivo(mode.turno.activo)
    } else {
      setFormNombre('')
      setFormHoraInicio('')
      setFormHoraFin('')
      setFormActivo(true)
    }
    setSheet(mode)
  }

  function handleGuardar() {
    if (!formNombre.trim() || !formHoraInicio || !formHoraFin) {
      setFormError('Ingresa nombre, hora de inicio y hora de fin.')
      return
    }
    setFormError(null)

    if (sheet.tipo === 'nuevo') {
      startTransition(async () => {
        const result = await crearTurnoHorario({
          nombre: formNombre.trim(),
          horaInicio: aHoraDb(formHoraInicio),
          horaFin: aHoraDb(formHoraFin),
        })
        if ('error' in result) { setFormError(result.error); return }
        setTurnos((prev) =>
          [
            ...prev,
            {
              id: result.id,
              nombre: formNombre.trim(),
              hora_inicio: aHoraDb(formHoraInicio),
              hora_fin: aHoraDb(formHoraFin),
              activo: true,
            },
          ].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
        )
        setSheet({ tipo: 'none' })
      })
      return
    }

    if (sheet.tipo === 'editar') {
      const turnoId = sheet.turno.id
      const patch = {
        nombre: formNombre.trim(),
        horaInicio: aHoraDb(formHoraInicio),
        horaFin: aHoraDb(formHoraFin),
        activo: formActivo,
      }
      startTransition(async () => {
        const result = await actualizarTurnoHorario(turnoId, patch)
        if (result?.error) { setFormError(result.error); return }
        setTurnos((prev) =>
          prev.map((t) =>
            t.id === turnoId
              ? { ...t, nombre: patch.nombre, hora_inicio: patch.horaInicio, hora_fin: patch.horaFin, activo: patch.activo }
              : t,
          ),
        )
        setSheet({ tipo: 'none' })
      })
    }
  }

  const sheetOpen = sheet.tipo !== 'none'

  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Patrones de turno
        </p>
      </div>
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs text-text-3">
          Al abrir un turno, si la hora actual cae dentro de exactamente uno de estos patrones
          activos, se empareja automáticamente — así se puede calcular el recordatorio de fin de
          turno. Sin coincidencia clara, el turno abre sin patrón (sin recordatorio).
        </p>

        {turnos.length > 0 ? (
          <div className="divide-y divide-[#F2F2F7] rounded-xl border border-[#F2F2F7]">
            {turnos.map((t) => (
              <button
                key={t.id}
                onClick={() => abrirSheet({ tipo: 'editar', turno: t })}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left active:bg-s2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold">{t.nombre}</p>
                    {!t.activo && (
                      <span className="flex-shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-text-3">
                    {aInputTime(t.hora_inicio)} – {aInputTime(t.hora_fin)}
                  </p>
                </div>
                <span className="text-[12px] font-medium text-[#173F2E]">Editar</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-s2 px-3.5 py-3 text-center text-xs text-text-4">
            Sin patrones de turno configurados.
          </p>
        )}

        <button
          onClick={() => abrirSheet({ tipo: 'nuevo' })}
          className="w-full rounded-xl border-[1.5px] border-dashed border-border py-2.5 text-[13px] font-semibold text-text-3 active:bg-s2"
        >
          + Nuevo patrón
        </button>
      </div>

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSheet({ tipo: 'none' })}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ease-out ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-s3" />
        <div className="flex-shrink-0 border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-[17px] font-bold">
            {sheet.tipo === 'editar' ? 'Editar patrón de turno' : 'Nuevo patrón de turno'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
              Nombre *
            </label>
            <input
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="Ej: Matutino"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Hora inicio *
              </label>
              <input
                type="time"
                value={formHoraInicio}
                onChange={(e) => setFormHoraInicio(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Hora fin *
              </label>
              <input
                type="time"
                value={formHoraFin}
                onChange={(e) => setFormHoraFin(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E] focus:bg-white"
              />
            </div>
          </div>
          <p className="text-[11px] text-text-4">
            Si la hora fin es menor a la hora inicio, se interpreta como un turno que cruza
            medianoche (ej. 22:00–02:00).
          </p>

          {sheet.tipo === 'editar' && (
            <div className="flex items-center justify-between border-t border-[#F2F2F7] pt-3">
              <div className="min-w-0 pr-3">
                <p className="text-[13px] text-text-2">Activo</p>
                <p className="text-[11px] text-text-4">
                  Desactivar lo saca del emparejamiento automático al abrir turno.
                </p>
              </div>
              <button
                onClick={() => setFormActivo((v) => !v)}
                className={`relative flex-shrink-0 h-[26px] w-[46px] rounded-full transition-colors duration-200 ${
                  formActivo ? 'bg-[#173F2E]' : 'bg-[#D1D1D6]'
                }`}
              >
                <span
                  className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
                    formActivo ? 'translate-x-[22px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={handleGuardar}
            disabled={isPending}
            className="w-full rounded-xl bg-[#173F2E] py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(23,63,46,.32)] active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
