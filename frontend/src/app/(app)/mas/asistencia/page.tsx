import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import { AsistenciaShell } from '@/components/asistencia/AsistenciaShell'
import { obtenerHistorialAsistencia } from './actions'
import { fechaHoyMX, sumarDiasFecha } from '@/lib/fechaMx'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type AsistenciaFiltros = {
  usuarioId: string | null
  desde: string
  hasta: string
}

export type AsistenciaRow = {
  id: number
  usuarioId: string
  usuarioNombre: string
  entrada: string
  salida: string | null
}

export type UsuarioOpcion = {
  id: string
  nombre: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AsistenciaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single<Pick<Perfil, 'rol' | 'nombre'>>()

  const isAdmin = perfil?.rol === 'admin'

  // ── Estado propio: ¿tengo una entrada sin marcar salida? ───────────────────
  const { data: entradaAbierta } = await supabase
    .from('asistencia')
    .select('id, entrada')
    .eq('usuario_id', user.id)
    .is('salida', null)
    .maybeSingle()

  // ── Historial + filtro por usuario (solo admin) ─────────────────────────────
  let historialInicial: AsistenciaRow[] = []
  let usuariosOpciones: UsuarioOpcion[] = []
  let filtrosIniciales: AsistenciaFiltros = {
    usuarioId: null,
    desde: sumarDiasFecha(fechaHoyMX(), -30),
    hasta: fechaHoyMX(),
  }

  if (isAdmin) {
    const [historialResult, { data: perfilesData }] = await Promise.all([
      obtenerHistorialAsistencia(filtrosIniciales),
      supabase.from('perfiles').select('id, nombre').order('nombre'),
    ])
    historialInicial = Array.isArray(historialResult) ? historialResult : []
    usuariosOpciones = (perfilesData ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))
  }

  return (
    <AsistenciaShell
      isAdmin={isAdmin}
      entradaAbiertaEn={entradaAbierta?.entrada ?? null}
      historialInicial={historialInicial}
      usuariosOpciones={usuariosOpciones}
      filtrosIniciales={filtrosIniciales}
    />
  )
}
