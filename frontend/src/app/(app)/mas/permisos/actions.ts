'use server'

import { createClient } from '@/lib/supabase/server'

type Err = { error: string }

export async function actualizarPermiso(
  campo: string,
  valor: boolean,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ [campo]: valor })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar el permiso.' }
}

export async function actualizarBanco(patch: {
  transferencia_banco?: string | null
  transferencia_clabe?: string | null
  transferencia_titular?: string | null
}): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update(patch)
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar los datos bancarios.' }
}

export async function actualizarPropina(
  pct: number,
): Promise<Err | undefined> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('config_sistema')
    .update({ propina_sugerida_pct: pct })
    .eq('id', 1)

  if (error) return { error: 'Error al actualizar la propina.' }
}
