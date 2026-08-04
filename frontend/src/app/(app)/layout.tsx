import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { InactivityGuard } from '@/components/layout/InactivityGuard'
import type { ConfigSistema, Perfil } from '@/lib/types/database.types'

// Layout protegido: verifica sesión y carga el perfil del usuario.
// Todas las rutas dentro de (app) heredan este layout con el BottomNav.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: perfil }, { data: config }, { count: pedidosActivos }] = await Promise.all([
    supabase.from('perfiles').select('*').eq('id', user.id).single<Perfil>(),
    supabase
      .from('config_sistema')
      .select('timeout_inactividad_minutos')
      .eq('id', 1)
      .single<Pick<ConfigSistema, 'timeout_inactividad_minutos'>>(),
    // Contar pedidos activos para el badge del BottomNav
    supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
  ])

  if (!perfil) redirect('/login')

  // Cuenta desactivada (/mas/usuarios → toggle Activo): el guard de
  // inactividad (F7-08, InactivityGuard.tsx) cierra sesión del lado del
  // cliente por timeout; esto es lo mismo pero server-side y en cada
  // navegación, porque perfiles.activo puede cambiar en cualquier momento
  // mientras el usuario ya tiene una sesión abierta.
  if (!perfil.activo) {
    await supabase.auth.signOut()
    redirect(`/login?mensaje=${encodeURIComponent('Tu cuenta ha sido desactivada. Contacta al administrador.')}`)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <InactivityGuard timeoutMinutos={config?.timeout_inactividad_minutos ?? 15} />

      {/* Contenido de la pantalla — padding inferior para el BottomNav */}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <BottomNav rol={perfil.rol} pedidosActivos={pedidosActivos ?? 0} />
    </div>
  )
}
