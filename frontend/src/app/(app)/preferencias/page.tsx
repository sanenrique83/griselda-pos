import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PreferenciasShell } from '@/components/preferencias/PreferenciasShell'
import type { Perfil } from '@/lib/types/database.types'

export default async function PreferenciasPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('sonido_activado, vibracion_activada')
    .eq('id', user.id)
    .single<Pick<Perfil, 'sonido_activado' | 'vibracion_activada'>>()

  return (
    <PreferenciasShell
      sonidoActivado={perfil?.sonido_activado ?? true}
      vibracionActivada={perfil?.vibracion_activada ?? true}
    />
  )
}
