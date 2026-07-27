import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NuevaCompraShell } from '@/components/inventario/NuevaCompraShell'

export default async function NuevaCompraPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'admin') redirect('/mesas')

  const [{ data: rawProveedores }, { data: rawInsumos }] = await Promise.all([
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('insumos').select('id, nombre, unidad_medida').eq('activo', true).order('nombre'),
  ])

  const proveedores = (rawProveedores ?? []).map((p: any) => ({ id: p.id, nombre: p.nombre }))
  const insumos = (rawInsumos ?? []).map((i: any) => ({
    id: i.id,
    nombre: i.nombre,
    unidad_medida: i.unidad_medida,
  }))

  return <NuevaCompraShell proveedores={proveedores} insumos={insumos} />
}
