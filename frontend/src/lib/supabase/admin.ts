import { createClient } from '@supabase/supabase-js'

// Cliente con la service_role key — SOLO para Server Actions que necesitan
// la API de administración de Supabase Auth (crear usuarios), que la key
// pública/anon no puede hacer. NUNCA importar desde un componente cliente:
// SUPABASE_SERVICE_ROLE_KEY no lleva prefijo NEXT_PUBLIC_, así que Next.js
// no la incluye en el bundle del navegador, pero solo mientras este archivo
// se use exclusivamente desde código 'use server'.
//
// Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY (Project
// Settings → API → service_role, en el dashboard de Supabase) — agregarla a
// .env.local y a las variables de entorno del proyecto en Vercel.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.',
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
