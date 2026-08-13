'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import type { RolUsuario } from '@/lib/types/database.types'

type Err = { error: string }

async function verificarAdmin(): Promise<Err | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return { error: 'Solo un admin puede administrar usuarios.' }

  return null
}

// ─── Crear usuario ──────────────────────────────────────────────────────────
// Usa el cliente admin (service_role) para crear la fila en auth.users — la
// API pública/anon no puede hacer esto. El trigger on_auth_user_created ya
// existente crea la fila en perfiles automáticamente (nombre/rol vía
// user_metadata); aquí solo se completan teléfono/fecha de contratación
// después, si se capturaron.
export async function crearUsuario(data: {
  email: string
  password: string
  nombre: string
  rol: RolUsuario
  telefono?: string | null
  fechaContratacion?: string | null
}): Promise<{ id: string } | Err> {
  const errAdmin = await verificarAdmin()
  if (errAdmin) return errAdmin

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('[crearUsuario] cliente admin no disponible:', e)
    return { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' }
  }

  const { data: nuevo, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { nombre: data.nombre, rol: data.rol },
  })

  if (error || !nuevo.user) {
    return { error: error?.message ?? 'Error al crear el usuario.' }
  }

  if (data.telefono || data.fechaContratacion) {
    const supabase = await createClient()
    const { error: updErr } = await supabase
      .from('perfiles')
      .update({
        telefono: data.telefono || null,
        fecha_contratacion: data.fechaContratacion || null,
      })
      .eq('id', nuevo.user.id)

    if (updErr) {
      // El usuario ya se creó — no se pierde por esto, solo queda sin estos
      // dos campos hasta que se editen a mano.
      console.error('[crearUsuario] error completando telefono/fecha_contratacion:', {
        usuarioId: nuevo.user.id,
        error: updErr.message,
      })
    }
  }

  revalidatePath('/mas/usuarios')
  return { id: nuevo.user.id }
}

// ─── Editar usuario ─────────────────────────────────────────────────────────
// Solo toca perfiles (RLS ya permite a un admin editar cualquier fila — ver
// policy "perfil_propio_update"), nunca auth.users.
export async function actualizarUsuario(
  id: string,
  patch: {
    nombre?: string
    rol?: RolUsuario
    telefono?: string | null
    fecha_contratacion?: string | null
    activo?: boolean
  },
): Promise<Err | undefined> {
  const errAdmin = await verificarAdmin()
  if (errAdmin) return errAdmin

  const supabase = await createClient()
  const { error } = await supabase.from('perfiles').update(patch).eq('id', id)
  if (error) return { error: 'Error al actualizar el usuario.' }

  revalidatePath('/mas/usuarios')
  revalidatePath('/mesas')
}

// ─── PIN rápido (/cambiar-usuario) ─────────────────────────────────────────
// pin_hash nunca se lee/escribe con el cliente normal — aunque
// perfil_propio_update ya dejaría a un admin editar cualquier fila, se usa
// el cliente admin aquí también por consistencia con cambiarUsuario() (la
// otra mitad del flujo), que sí lo necesita porque corre en el contexto de
// quien se está cambiando DE cuenta, no del admin.
export async function actualizarPin(
  id: string,
  pin: string,
): Promise<Err | undefined> {
  const errAdmin = await verificarAdmin()
  if (errAdmin) return errAdmin

  if (!/^\d{4}$/.test(pin)) return { error: 'El PIN debe ser de 4 dígitos.' }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('[actualizarPin] cliente admin no disponible:', e)
    return { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' }
  }

  const pinHash = await bcrypt.hash(pin, 10)
  const { error } = await admin
    .from('perfiles')
    .update({ pin_hash: pinHash, pin_intentos_fallidos: 0, pin_bloqueado_hasta: null })
    .eq('id', id)

  if (error) return { error: 'Error al guardar el PIN.' }

  revalidatePath('/mas/usuarios')
}

export async function quitarPin(id: string): Promise<Err | undefined> {
  const errAdmin = await verificarAdmin()
  if (errAdmin) return errAdmin

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('[quitarPin] cliente admin no disponible:', e)
    return { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' }
  }

  const { error } = await admin
    .from('perfiles')
    .update({ pin_hash: null, pin_intentos_fallidos: 0, pin_bloqueado_hasta: null })
    .eq('id', id)

  if (error) return { error: 'Error al quitar el PIN.' }

  revalidatePath('/mas/usuarios')
}

// ─── Restablecer contraseña (admin) ────────────────────────────────────────
// Mismo patrón que crearUsuario(): cliente admin (service_role), única API
// que puede tocar auth.users. Acción sensible aparte de actualizarUsuario()
// a propósito — no comparte sheet con el formulario general de edición.
export async function restablecerPassword(
  usuarioId: string,
  nuevaPassword: string,
): Promise<Err | undefined> {
  const errAdmin = await verificarAdmin()
  if (errAdmin) return errAdmin

  if (nuevaPassword.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('[restablecerPassword] cliente admin no disponible:', e)
    return { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' }
  }

  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: nuevaPassword })
  if (error) return { error: error.message ?? 'Error al restablecer la contraseña.' }
}
