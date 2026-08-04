import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UsuariosShell } from '@/components/usuarios/UsuariosShell'
import type { Perfil, RolUsuario } from '@/lib/types/database.types'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type UsuarioRow = {
  id: string
  nombre: string
  rol: RolUsuario
  activo: boolean
  telefono: string | null
  fechaContratacion: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function UsuariosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilPropio } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single<Pick<Perfil, 'rol'>>()

  if (perfilPropio?.rol !== 'admin') redirect('/mas')

  const { data: perfilesRaw } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, activo, telefono, fecha_contratacion')
    .order('nombre')

  const usuarios: UsuarioRow[] = (perfilesRaw ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    rol: p.rol as RolUsuario,
    activo: p.activo,
    telefono: p.telefono,
    fechaContratacion: p.fecha_contratacion,
  }))

  return <UsuariosShell usuarios={usuarios} />
}
