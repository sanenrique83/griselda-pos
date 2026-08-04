'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'

type Err = { error: string }

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 5

// ─── Cambiar de usuario (PIN rápido) ───────────────────────────────────────
// Intercambio de sesión real (no un "usuario activo" paralelo): se emite un
// magic-link vía el cliente admin (service_role) y se consume con
// verifyOtp() en el cliente normal, que reemplaza la cookie de sesión con
// una sesión legítima del usuario destino — auth.uid() pasa a ser el suyo
// en todos lados (RLS, mesero_id, es_admin()), sin ningún mecanismo aparte.
//
// pin_hash y los contadores de intentos se leen/escriben SOLO con el
// cliente admin — perfiles.RLS nunca se toca, así que ninguna consulta
// desde el cliente (ni siquiera de un admin autenticado normal) puede leer
// pin_hash de otro usuario.
export async function cambiarUsuario(
  targetUserId: string,
  pin: string,
): Promise<Err | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  if (!/^\d{4}$/.test(pin)) return { error: 'El PIN debe ser de 4 dígitos.' }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('[cambiarUsuario] cliente admin no disponible:', e)
    return { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' }
  }

  const { data: perfil, error: perfilErr } = await admin
    .from('perfiles')
    .select('pin_hash, activo, pin_intentos_fallidos, pin_bloqueado_hasta')
    .eq('id', targetUserId)
    .single()

  if (perfilErr || !perfil || !perfil.activo) {
    return { error: 'Usuario no disponible.' }
  }
  if (!perfil.pin_hash) {
    return { error: 'Este usuario no tiene PIN configurado.' }
  }

  // Bloqueo por intentos — se revisa ANTES de comparar el PIN, para que un
  // intento durante el bloqueo ni siquiera cueste un bcrypt.compare().
  if (perfil.pin_bloqueado_hasta && new Date(perfil.pin_bloqueado_hasta) > new Date()) {
    const minutosRestantes = Math.ceil(
      (new Date(perfil.pin_bloqueado_hasta).getTime() - Date.now()) / 60_000,
    )
    return { error: `Demasiados intentos. Intenta de nuevo en ${minutosRestantes} min.` }
  }

  const coincide = await bcrypt.compare(pin, perfil.pin_hash)

  if (!coincide) {
    const intentos = perfil.pin_intentos_fallidos + 1
    const bloqueado = intentos >= MAX_INTENTOS
    await admin
      .from('perfiles')
      .update({
        pin_intentos_fallidos: bloqueado ? 0 : intentos,
        pin_bloqueado_hasta: bloqueado
          ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000).toISOString()
          : null,
      })
      .eq('id', targetUserId)

    return {
      error: bloqueado
        ? `Demasiados intentos. Intenta de nuevo en ${BLOQUEO_MINUTOS} min.`
        : 'PIN incorrecto.',
    }
  }

  // PIN correcto — limpiar contador y hacer el intercambio de sesión.
  await admin
    .from('perfiles')
    .update({ pin_intentos_fallidos: 0, pin_bloqueado_hasta: null })
    .eq('id', targetUserId)

  const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(targetUserId)
  if (targetErr || !targetUser.user?.email) {
    return { error: 'No se pudo cambiar de usuario.' }
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.user.email,
  })
  if (linkErr || !link) {
    console.error('[cambiarUsuario] error generando link:', linkErr?.message)
    return { error: 'No se pudo cambiar de usuario.' }
  }

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyErr) {
    console.error('[cambiarUsuario] error verificando sesión:', verifyErr.message)
    return { error: 'No se pudo cambiar de usuario.' }
  }

  return { ok: true }
}
