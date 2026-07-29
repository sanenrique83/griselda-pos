import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'
import { LienzoMesasEditor } from '@/components/mapa-mesas/LienzoMesasEditor'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type MesaEditable = {
  id: number
  numero: number
  nombre: string | null
  areaNombre: string
  forma: FormaMesa
  tamano: TamanoMesa
  rotacion: number
  posX: number | null
  posY: number | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MapaMesasPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single<Pick<Perfil, 'rol'>>()

  if (perfil?.rol !== 'admin') redirect('/mas')

  const { data: mesasRaw } = await supabase
    .from('mesas')
    .select('id, numero, nombre, pos_x, pos_y, rotacion, forma, tamano, areas(nombre)')
    .eq('activa', true)
    .order('numero')

  const mesas: MesaEditable[] = (mesasRaw ?? []).map((m) => ({
    id: m.id,
    numero: m.numero,
    nombre: m.nombre,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    areaNombre: (m.areas as any)?.nombre ?? 'Sin área',
    forma: (m.forma as FormaMesa) ?? 'rectangulo',
    tamano: (m.tamano as TamanoMesa) ?? 'medio',
    rotacion: m.rotacion ?? 0,
    posX: m.pos_x,
    posY: m.pos_y,
  }))

  return <LienzoMesasEditor mesas={mesas} />
}
