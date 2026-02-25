import { redirect } from 'next/navigation'

// La raíz redirige siempre a /mesas.
// El middleware se encarga de redirigir a /login si no hay sesión.
export default function RootPage() {
  redirect('/mesas')
}
