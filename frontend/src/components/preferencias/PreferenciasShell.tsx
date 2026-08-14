'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderB } from '@/components/ui/HeaderB'
import { Boton } from '@/components/ui/Boton'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { setPreferenciasFeedback, dispararFeedback } from '@/lib/feedback'
import { cambiarMiPassword, actualizarPreferenciasFeedback } from '@/app/(app)/preferencias/actions'

// ─── Toggle Row (mismo patrón visual que PermisosShell.tsx) ────────────────

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
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#F2F2F7] last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-[14px] font-medium leading-tight">{label}</p>
        <p className="text-[12px] text-text-3 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`relative flex-shrink-0 h-[28px] w-[50px] rounded-full transition-colors duration-200 disabled:opacity-40 ${
          value ? 'bg-[#173F2E]' : 'bg-[#D1D1D6]'
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

interface PreferenciasShellProps {
  sonidoActivado: boolean
  vibracionActivada: boolean
}

export function PreferenciasShell({ sonidoActivado, vibracionActivada }: PreferenciasShellProps) {
  const router = useRouter()

  // ── Sonido / vibración ────────────────────────────────────────────────────
  const [sonido, setSonido] = useState(sonidoActivado)
  const [vibracion, setVibracion] = useState(vibracionActivada)
  const [isPendingFeedback, startFeedbackTransition] = useTransition()
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  function handleToggleFeedback(campo: 'sonido' | 'vibracion', valor: boolean) {
    const nuevoSonido = campo === 'sonido' ? valor : sonido
    const nuevoVibracion = campo === 'vibracion' ? valor : vibracion

    // Optimistic update — también sincroniza el módulo singleton de
    // lib/feedback.ts al instante, para que el próximo tap ya lo respete
    // sin esperar a un refresh del layout server-side.
    if (campo === 'sonido') setSonido(valor)
    else setVibracion(valor)
    setPreferenciasFeedback(nuevoSonido, nuevoVibracion)
    setFeedbackError(null)

    startFeedbackTransition(async () => {
      const result = await actualizarPreferenciasFeedback(nuevoSonido, nuevoVibracion)
      if (result?.error) {
        // Rollback
        if (campo === 'sonido') setSonido(!valor)
        else setVibracion(!valor)
        setPreferenciasFeedback(campo === 'sonido' ? !valor : sonido, campo === 'vibracion' ? !valor : vibracion)
        setFeedbackError(result.error)
        return
      }
      // Confirmación audible/táctil inmediata de que el toggle sí quedó (usa
      // los valores recién guardados, no los previos).
      if (nuevoSonido || nuevoVibracion) dispararFeedback('confirmar')
    })
  }

  // ── Contraseña ─────────────────────────────────────────────────────────────
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwBanner, setPwBanner] = useState<string | null>(null)
  const [isPendingPw, startPwTransition] = useTransition()

  function handleGuardarPassword() {
    if (!passwordActual.trim()) {
      setPwError('Ingresa tu contraseña actual.')
      return
    }
    if (passwordNueva.length < 6) {
      setPwError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    setPwError(null)
    setPwBanner(null)
    startPwTransition(async () => {
      const result = await cambiarMiPassword(passwordActual, passwordNueva)
      if (result?.error) {
        setPwError(result.error)
        return
      }
      setPasswordActual('')
      setPasswordNueva('')
      setPwBanner('Contraseña actualizada ✓')
    })
  }

  return (
    <div className="min-h-full bg-s2">
      <HeaderB backLabel="Más" onBack={() => router.push('/mas')} titulo="Preferencias" />

      <div className="px-4 py-4 space-y-4">
        {/* ── Sonido y vibración ─────────────────────────────────────────── */}
        <div>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Sonido y vibración
          </p>
          <Tarjeta className="py-0 px-4">
            <ToggleRow
              label="Sonido"
              desc="Tono corto al agregar, confirmar, cobrar o cancelar"
              value={sonido}
              onChange={(v) => handleToggleFeedback('sonido', v)}
              disabled={isPendingFeedback}
            />
            <ToggleRow
              label="Vibración"
              desc="No tiene efecto en iPhone/iPad — Apple no lo permite en Safari"
              value={vibracion}
              onChange={(v) => handleToggleFeedback('vibracion', v)}
              disabled={isPendingFeedback}
            />
          </Tarjeta>
          {feedbackError && <p className="mt-2 px-1 text-sm font-semibold text-red-600">{feedbackError}</p>}
        </div>

        {/* ── Contraseña ─────────────────────────────────────────────────── */}
        <div>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Contraseña
          </p>
          <Tarjeta className="space-y-3">
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

            {pwError && <p className="text-sm font-semibold text-red-600">{pwError}</p>}
            {pwBanner && <p className="text-sm font-semibold text-[#173F2E]">{pwBanner}</p>}

            <Boton onClick={handleGuardarPassword} disabled={isPendingPw}>
              {isPendingPw ? 'Guardando…' : 'Cambiar contraseña'}
            </Boton>
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
