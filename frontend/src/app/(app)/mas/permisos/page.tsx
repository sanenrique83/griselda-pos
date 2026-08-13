import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PermisosShell } from '@/components/permisos/PermisosShell'
import type { ConfigSistema, TurnoHorario } from '@/lib/types/database.types'

export type ConfigPermisos = Pick<
  ConfigSistema,
  | 'cancelaciones_mesero'
  | 'descuentos_mesero'
  | 'cancelar_pedido_mesero'
  | 'ver_dashboard_mesero'
  | 'panel_turno_mesero_financiero'
  | 'propina_sugerida_pct'
  | 'propinas_sugeridas_pct'
  | 'transferencia_banco'
  | 'transferencia_clabe'
  | 'transferencia_titular'
  | 'timeout_inactividad_minutos'
  | 'orden_productos'
  | 'orden_modificadores'
  | 'alerta_mesa_sin_atender'
  | 'alerta_mesa_sin_atender_minutos'
  | 'modificadores_por_linea'
  | 'tiempo_mesa_alerta_minutos'
  | 'alerta_ventas_bajas_activa'
  | 'alerta_ventas_bajas_umbral_pct'
  | 'turno_diferencia_alerta_monto'
  | 'alerta_precuenta_activa'
  | 'alerta_precuenta_minutos'
  | 'orden_popularidad_dias'
  | 'formato_modificadores_ticket'
  | 'recordatorio_fin_turno_activo'
  | 'recordatorio_fin_turno_minutos'
  | 'cobro_solo_admin'
>

export default async function PermisosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Solo admin
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'admin') redirect('/mesas')

  const [{ data: config }, { data: turnosHorario }] = await Promise.all([
    supabase
      .from('config_sistema')
      .select(
        'cancelaciones_mesero, descuentos_mesero, cancelar_pedido_mesero, ver_dashboard_mesero, panel_turno_mesero_financiero, propina_sugerida_pct, propinas_sugeridas_pct, transferencia_banco, transferencia_clabe, transferencia_titular, timeout_inactividad_minutos, orden_productos, orden_modificadores, alerta_mesa_sin_atender, alerta_mesa_sin_atender_minutos, modificadores_por_linea, tiempo_mesa_alerta_minutos, alerta_ventas_bajas_activa, alerta_ventas_bajas_umbral_pct, turno_diferencia_alerta_monto, alerta_precuenta_activa, alerta_precuenta_minutos, orden_popularidad_dias, formato_modificadores_ticket, recordatorio_fin_turno_activo, recordatorio_fin_turno_minutos, cobro_solo_admin',
      )
      .eq('id', 1)
      .single(),
    supabase.from('turnos_horario').select('id, nombre, hora_inicio, hora_fin, activo').order('hora_inicio'),
  ])

  if (!config) redirect('/mas')

  return (
    <PermisosShell
      config={config as ConfigPermisos}
      turnosHorario={(turnosHorario ?? []) as TurnoHorario[]}
    />
  )
}
