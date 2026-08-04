'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BotonRegresarMas } from '@/components/layout/BotonRegresarMas'
import { cambiarUsuario } from '@/app/(app)/cambiar-usuario/actions'
import type { UsuarioSwitchable } from '@/app/(app)/cambiar-usuario/page'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

interface CambiarUsuarioShellProps {
  usuarios: UsuarioSwitchable[]
}

export function CambiarUsuarioShell({ usuarios }: CambiarUsuarioShellProps) {
  const router = useRouter()
  const [seleccionado, setSeleccionado] = useState<UsuarioSwitchable | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function elegirUsuario(u: UsuarioSwitchable) {
    setSeleccionado(u)
    setPin('')
    setError(null)
  }

  function volver() {
    setSeleccionado(null)
    setPin('')
    setError(null)
  }

  function handleTecla(tecla: string) {
    if (isPending || !tecla) return
    setError(null)
    if (tecla === '⌫') {
      setPin((prev) => prev.slice(0, -1))
      return
    }
    if (pin.length >= 4) return
    const siguiente = pin + tecla
    setPin(siguiente)
    if (siguiente.length === 4 && seleccionado) {
      startTransition(async () => {
        const result = await cambiarUsuario(seleccionado.id, siguiente)
        if ('error' in result) {
          setError(result.error)
          setPin('')
          return
        }
        router.push('/mesas')
        router.refresh()
      })
    }
  }

  return (
    <div className="min-h-full bg-s2">
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <BotonRegresarMas />
        <h1 className="mt-1 text-[20px] font-bold leading-tight">Cambiar de usuario</h1>
      </div>

      <div className="px-4 py-4">
        {!seleccionado ? (
          usuarios.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-card px-4 py-8 text-center">
              <p className="text-sm text-text-3">
                No hay otros usuarios con PIN configurado. Configúralo desde Más → Usuarios.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-card overflow-hidden">
              <div className="divide-y divide-[#F2F2F7]">
                {usuarios.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => elegirUsuario(u)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-s2"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[15px] font-bold text-blue-600">
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.nombre}</p>
                      <p className="text-xs text-text-3">{u.rol === 'admin' ? 'Administrador' : 'Mesero'}</p>
                    </div>
                    <span className="text-text-4">›</span>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center pt-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-xl font-bold text-blue-600">
              {seleccionado.nombre.charAt(0).toUpperCase()}
            </div>
            <p className="mt-3 text-[15px] font-semibold">{seleccionado.nombre}</p>
            <button
              onClick={volver}
              className="mt-1 text-[12px] font-medium text-blue-600 active:opacity-60"
            >
              No soy yo — cambiar
            </button>

            {/* Dots del PIN */}
            <div className="mt-6 flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                    i < pin.length ? 'border-blue-600 bg-blue-600' : 'border-[#D1D1D6] bg-transparent'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="mt-3 text-center text-sm font-semibold text-red-600">{error}</p>
            )}
            {isPending && (
              <p className="mt-3 text-center text-sm text-text-3">Verificando…</p>
            )}

            {/* Teclado numérico */}
            <div className="mt-8 grid w-full max-w-[280px] grid-cols-3 gap-3">
              {TECLAS.map((tecla, idx) =>
                tecla ? (
                  <button
                    key={idx}
                    onClick={() => handleTecla(tecla)}
                    disabled={isPending}
                    className="rounded-2xl bg-white py-4 text-xl font-semibold text-text-1 shadow-card active:scale-[.96] disabled:opacity-40"
                  >
                    {tecla}
                  </button>
                ) : (
                  <div key={idx} />
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
