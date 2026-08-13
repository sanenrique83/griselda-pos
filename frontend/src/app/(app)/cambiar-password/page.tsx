import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CambiarMiPasswordShell } from '@/components/cambiar-password/CambiarMiPasswordShell'

export default async function CambiarPasswordPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <CambiarMiPasswordShell />
}
