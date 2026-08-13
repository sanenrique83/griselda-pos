'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderB } from '@/components/ui/HeaderB'
import { Boton } from '@/components/ui/Boton'
import { cambiarMiPassword } from '@/app/(app)/cambiar-password/actions'

export function CambiarMiPasswordShell() {
  const router = useRouter()
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGuardar() {
    if (!passwordActual.trim()) {
      setError('Ingresa tu contraseña actual.')
      return
    }
    if (passwordNueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    setError(null)
    setBanner(null)
    startTransition(async () => {
      const result = await cambiarMiPassword(passwordActual, passwordNueva)
      if (result?.error) {
        setError(result.error)
        return
      }
      setPasswordActual('')
      setPasswordNueva('')
      setBanner('Contraseña actualizada ✓')
    })
  }

  return (
    <div className="min-h-full bg-s2">
      <HeaderB backLabel="Más" onBack={() => router.push('/mas')} titulo="Cambiar mi contraseña" />

      <div className="px-4 py-4 space-y-4">
        <div className="rounded-2xl bg-white shadow-card px-4 py-4 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Contraseña actual *
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-[14px] outline-none focus:border-[#173F2E]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Nueva contraseña *
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-[14px] outline-none focus:border-[#173F2E]"
            />
          </div>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          {banner && <p className="text-sm font-semibold text-[#173F2E]">{banner}</p>}

          <Boton onClick={handleGuardar} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Cambiar contraseña'}
          </Boton>
        </div>
      </div>
    </div>
  )
}
