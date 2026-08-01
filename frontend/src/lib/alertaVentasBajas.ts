// Alerta de ventas bajas en tiempo real (F9-06) — compartido por Dashboard y
// /mesas, ambos consumen la misma RPC dashboard_alerta_ventas_bajas() y
// aplican el mismo umbral configurable de config_sistema.

export type FilaAlertaVentasBajas = {
  turno_id: number
  total_actual: number
  promedio_historico: number | null
  turnos_comparados: number
}

export type ConfigAlertaVentasBajas = {
  alerta_ventas_bajas_activa: boolean
  alerta_ventas_bajas_umbral_pct: number
}

export type AlertaVentasBajas = {
  totalActual: number
  promedioHistorico: number
  desviacionPct: number
}

// null si la alerta está apagada, sin suficiente historial (turnos_comparados
// = 0, o promedio en $0 — no hay contra qué comparar), o si la desviación no
// alcanza el umbral configurado.
export function calcularAlertaVentasBajas(
  config: ConfigAlertaVentasBajas | null | undefined,
  fila: FilaAlertaVentasBajas | null | undefined,
): AlertaVentasBajas | null {
  if (!config?.alerta_ventas_bajas_activa) return null
  if (!fila || fila.turnos_comparados <= 0) return null
  if (fila.promedio_historico === null || fila.promedio_historico <= 0) return null

  const desviacionPct = ((fila.total_actual - fila.promedio_historico) / fila.promedio_historico) * 100
  if (desviacionPct > -config.alerta_ventas_bajas_umbral_pct) return null

  return {
    totalActual: fila.total_actual,
    promedioHistorico: fila.promedio_historico,
    desviacionPct,
  }
}
