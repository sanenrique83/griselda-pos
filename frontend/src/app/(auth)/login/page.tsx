'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const mensaje = searchParams.get('mensaje')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    router.push('/mesas')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Nombre */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text">Griselda POS</h1>
          <p className="mt-1 text-sm text-text-3">La Menudería — El Arenal, Jalisco</p>
        </div>

        {mensaje && (
          <p className="mb-4 rounded-card bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {mensaje}
          </p>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-2">
              Correo
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-card border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-[#173F2E] focus:ring-2 focus:ring-[#173F2E]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-2">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-card border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-[#173F2E] focus:ring-2 focus:ring-[#173F2E]/20"
            />
          </div>

          {error && (
            <p className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="touch-target w-full rounded-card bg-[#173F2E] px-4 py-[18px] text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
