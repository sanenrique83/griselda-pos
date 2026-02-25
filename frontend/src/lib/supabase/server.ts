import { createServerClient, type CookieOptions } from '@supabase/ssr' // Añade type CookieOptions
import { cookies } from 'next/headers'

// Cliente para uso en Server Components, Server Actions y Route Handlers.
// Lee y escribe cookies para mantener la sesión del usuario.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
       setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
    try {
        cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
        )
    } catch {
        // En Server Components el setter no funciona...
    }
        },
      },
    }
  )
}