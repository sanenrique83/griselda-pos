'use server'

import { createClient } from '@/lib/supabase/server'

type Err = { error: string }

// ─── Cambiar mi propia contraseña ──────────────────────────────────────────
// Cliente normal de sesión (no el admin) — disponible para cualquier usuario
// autenticado, no solo admin. Reautentica con passwordActual antes de
// aplicar passwordNueva (signInWithPassword falla si está equivocada, sin
// necesidad de leer/comparar el hash a mano) — confirma identidad real, no
// solo que haya una sesión válida abierta.
export async function cambiarMiPassword(
  passwordActual: string,
  passwordNueva: string,
): Promise<Err | undefined> {
  if (!passwordActual.trim()) return { error: 'Ingresa tu contraseña actual.' }
  if (passwordNueva.length < 6) {
    return { error: 'La nueva contraseña debe tener al menos 6 caracteres.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Sin sesión.' }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: passwordActual,
  })
  if (reauthError) return { error: 'La contraseña actual no es correcta.' }

  const { error: updateError } = await supabase.auth.updateUser({ password: passwordNueva })
  if (updateError) return { error: updateError.message ?? 'Error al actualizar la contraseña.' }
}
