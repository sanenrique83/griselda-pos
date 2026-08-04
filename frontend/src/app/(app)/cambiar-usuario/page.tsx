import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CambiarUsuarioShell } from '@/components/cambiar-usuario/CambiarUsuarioShell'
import type { RolUsuario } from '@/lib/types/database.types'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type UsuarioSwitchable = {
  id: string
  nombre: string
  rol: RolUsuario
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Lista de "a quién me puedo cambiar" — se arma con el cliente admin, no el
// normal: un mesero no tiene permiso (RLS) para leer filas de perfiles que
// no sean la suya, y esta pantalla necesita mostrar nombre/rol de TODOS los
// usuarios activos con PIN, sin importar quién la esté viendo. Nunca se
// selecciona pin_hash aquí — eso solo pasa dentro de cambiarUsuario().
export default async function CambiarUsuarioPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let usuarios: UsuarioSwitchable[] = []
  try {
    const admin = createAdminClient()
    const { data: perfilesRaw } = await admin
      .from('perfiles')
      .select('id, nombre, rol')
      .eq('activo', true)
      .not('pin_hash', 'is', null)
      .neq('id', user.id)
      .order('nombre')

    usuarios = (perfilesRaw ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      rol: p.rol as RolUsuario,
    }))
  } catch (e) {
    console.error('[CambiarUsuarioPage] cliente admin no disponible:', e)
  }

  return <CambiarUsuarioShell usuarios={usuarios} />
}
