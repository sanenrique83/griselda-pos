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
  // Nunca se manda el hash al cliente, solo si tiene uno guardado — para
  // decidir si el sheet de edición ofrece "Guardar PIN" o "Quitar PIN".
  tienePin: boolean
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

  // pin_hash se selecciona solo para derivar el booleano `tienePin` — nunca
  // se manda al cliente (ver UsuarioRow). RLS ya permite esto (admin ve
  // todas las columnas de todas las filas), pero el hash en sí no sale de
  // este map.
  const { data: perfilesRaw } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, activo, telefono, fecha_contratacion, pin_hash')
    .order('nombre')

  const usuarios: UsuarioRow[] = (perfilesRaw ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    rol: p.rol as RolUsuario,
    activo: p.activo,
    telefono: p.telefono,
    fechaContratacion: p.fecha_contratacion,
    tienePin: p.pin_hash !== null,
  }))

  return <UsuariosShell usuarios={usuarios} />
}
