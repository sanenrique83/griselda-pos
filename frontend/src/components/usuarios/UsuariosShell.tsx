'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { BotonRegresarMas } from '@/components/layout/BotonRegresarMas'
import { crearUsuario, actualizarUsuario } from '@/app/(app)/mas/usuarios/actions'
import type { UsuarioRow } from '@/app/(app)/mas/usuarios/page'
import type { RolUsuario } from '@/lib/types/database.types'

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'mesero', label: 'Mesero' },
  { value: 'admin', label: 'Administrador' },
]

function fmtFecha(fecha: string | null) {
  if (!fecha) return null
  // fecha ya viene 'YYYY-MM-DD' (columna DATE) — evita el corrimiento de
  // huso horario que da new Date('YYYY-MM-DD') al interpretarse como UTC.
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

type SheetMode = { tipo: 'none' } | { tipo: 'nuevo' } | { tipo: 'editar'; usuario: UsuarioRow }

interface UsuariosShellProps {
  usuarios: UsuarioRow[]
}

export function UsuariosShell({ usuarios: initial }: UsuariosShellProps) {
  const [usuarios, setUsuarios] = useState(initial)
  const [sheet, setSheet] = useState<SheetMode>({ tipo: 'none' })
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  // Form compartido (nuevo/editar — email y password solo aplican a "nuevo")
  const [fEmail, setFEmail] = useState('')
  const [fPassword, setFPassword] = useState('')
  const [fNombre, setFNombre] = useState('')
  const [fRol, setFRol] = useState<RolUsuario>('mesero')
  const [fTelefono, setFTelefono] = useState('')
  const [fFechaContratacion, setFFechaContratacion] = useState('')
  const [fActivo, setFActivo] = useState(true)

  function abrirSheet(mode: SheetMode) {
    setFormError(null)
    if (mode.tipo === 'editar') {
      setFNombre(mode.usuario.nombre)
      setFRol(mode.usuario.rol)
      setFTelefono(mode.usuario.telefono ?? '')
      setFFechaContratacion(mode.usuario.fechaContratacion ?? '')
      setFActivo(mode.usuario.activo)
    } else {
      setFEmail('')
      setFPassword('')
      setFNombre('')
      setFRol('mesero')
      setFTelefono('')
      setFFechaContratacion('')
      setFActivo(true)
    }
    setSheet(mode)
  }

  function handleGuardar() {
    if (!fNombre.trim()) {
      setFormError('Ingresa un nombre.')
      return
    }

    if (sheet.tipo === 'nuevo') {
      if (!fEmail.trim() || !fPassword.trim()) {
        setFormError('Ingresa correo y contraseña.')
        return
      }
      if (fPassword.length < 6) {
        setFormError('La contraseña debe tener al menos 6 caracteres.')
        return
      }
      setFormError(null)
      startTransition(async () => {
        const result = await crearUsuario({
          email: fEmail.trim(),
          password: fPassword,
          nombre: fNombre.trim(),
          rol: fRol,
          telefono: fTelefono.trim() || null,
          fechaContratacion: fFechaContratacion || null,
        })
        if ('error' in result) {
          setFormError(result.error)
          return
        }
        setUsuarios((prev) =>
          [
            ...prev,
            {
              id: result.id,
              nombre: fNombre.trim(),
              rol: fRol,
              activo: true,
              telefono: fTelefono.trim() || null,
              fechaContratacion: fFechaContratacion || null,
            },
          ].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        )
        setSheet({ tipo: 'none' })
      })
      return
    }

    if (sheet.tipo === 'editar') {
      const usuarioId = sheet.usuario.id
      const patch = {
        nombre: fNombre.trim(),
        rol: fRol,
        telefono: fTelefono.trim() || null,
        fecha_contratacion: fFechaContratacion || null,
        activo: fActivo,
      }
      setFormError(null)
      startTransition(async () => {
        const result = await actualizarUsuario(usuarioId, patch)
        if (result?.error) {
          setFormError(result.error)
          return
        }
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === usuarioId
              ? { ...u, nombre: patch.nombre, rol: patch.rol, telefono: patch.telefono, fechaContratacion: patch.fecha_contratacion, activo: patch.activo }
              : u,
          ),
        )
        setSheet({ tipo: 'none' })
      })
    }
  }

  const sheetOpen = sheet.tipo !== 'none'

  return (
    <div className="min-h-full bg-s2">
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <BotonRegresarMas />
        <h1 className="mt-1 text-[20px] font-bold leading-tight">Usuarios</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <button
          onClick={() => abrirSheet({ tipo: 'nuevo' })}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98]"
        >
          + Nuevo usuario
        </button>

        {usuarios.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-card px-4 py-8 text-center">
            <p className="text-sm text-text-3">No hay usuarios.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <div className="divide-y divide-[#F2F2F7]">
              {usuarios.map((u) => (
                <div key={u.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold leading-tight">{u.nombre}</p>
                        {!u.activo && (
                          <span className="flex-shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-3">
                        {ROLES.find((r) => r.value === u.rol)?.label ?? u.rol}
                        {u.telefono && ` · ${u.telefono}`}
                        {u.fechaContratacion && ` · Desde ${fmtFecha(u.fechaContratacion)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => abrirSheet({ tipo: 'editar', usuario: u })}
                      className="flex-shrink-0 text-[12px] font-medium text-blue-600 active:opacity-60"
                    >
                      Editar
                    </button>
                  </div>
                  <Link
                    href={`/mas/asistencia?usuarioId=${u.id}`}
                    className="mt-2 inline-block text-[12px] font-medium text-text-3 active:opacity-60"
                  >
                    Ver historial de asistencia →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* Sheet crear/editar */}
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
            {sheet.tipo === 'editar' ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {sheet.tipo === 'nuevo' && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  Correo *
                </label>
                <input
                  type="email"
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  placeholder="mesero@lamenuderia.com"
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-[14px] outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  Contraseña temporal *
                </label>
                <input
                  type="text"
                  value={fPassword}
                  onChange={(e) => setFPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-[14px] outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Nombre *
            </label>
            <input
              type="text"
              value={fNombre}
              onChange={(e) => setFNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-[14px] outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Rol
            </label>
            <div className="flex gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setFRol(r.value)}
                  className={`flex-1 rounded-lg px-2 py-2.5 text-[12px] font-semibold transition-colors ${
                    fRol === r.value ? 'bg-blue-600 text-white' : 'bg-s2 text-text-2'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Teléfono (opcional)
            </label>
            <input
              type="tel"
              value={fTelefono}
              onChange={(e) => setFTelefono(e.target.value)}
              placeholder="Ej: 3312345678"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-[14px] outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Fecha de contratación (opcional)
            </label>
            <input
              type="date"
              value={fFechaContratacion}
              onChange={(e) => setFFechaContratacion(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-[14px] outline-none focus:border-blue-500"
            />
          </div>

          {sheet.tipo === 'editar' && (
            <div className="flex items-center justify-between border-t border-[#F2F2F7] pt-3">
              <div className="min-w-0 pr-3">
                <p className="text-[13px] text-text-2">Activo</p>
                <p className="text-[11px] text-text-4">
                  Desactivar preserva su historial — nunca se elimina un usuario.
                </p>
              </div>
              <button
                onClick={() => setFActivo((v) => !v)}
                className={`relative flex-shrink-0 h-[26px] w-[46px] rounded-full transition-colors duration-200 ${
                  fActivo ? 'bg-blue-600' : 'bg-[#D1D1D6]'
                }`}
              >
                <span
                  className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
                    fActivo ? 'translate-x-[22px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          )}

          {formError && (
            <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</p>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[#E5E5EA] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3.5 space-y-2">
          <button
            onClick={handleGuardar}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-[14px] text-sm font-bold text-white shadow-[0_3px_10px_rgba(37,99,235,.28)] active:scale-[.98] disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : sheet.tipo === 'editar' ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          <button
            onClick={() => setSheet({ tipo: 'none' })}
            className="w-full rounded-xl bg-s2 py-[14px] text-sm font-semibold text-text-2 active:scale-[.98]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
