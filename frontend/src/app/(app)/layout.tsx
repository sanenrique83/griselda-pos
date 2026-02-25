import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import type { Perfil } from '@/lib/types/database.types'

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

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single<Perfil>()

  if (!perfil) redirect('/login')

  // Contar pedidos activos para el badge del BottomNav
  const { count: pedidosActivos } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'abierto')

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Contenido de la pantalla — padding inferior para el BottomNav */}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <BottomNav rol={perfil.rol} pedidosActivos={pedidosActivos ?? 0} />
    </div>
  )
}
