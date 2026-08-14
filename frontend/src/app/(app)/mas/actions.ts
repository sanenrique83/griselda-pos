'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Extraída de LogoutRow (antes inline en page.tsx) — ahora la llama
// LogoutButton.tsx (client) después de mostrar el mensaje de despedida un
// momento, ya que redirect() interrumpe cualquier código posterior a esta
// llamada.
export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
