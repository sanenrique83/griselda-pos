-- Alerta de ventas bajas en tiempo real: compara el total cobrado del turno
-- activo, hasta la hora actual, contra el promedio histórico de turnos del
-- mismo día de la semana A ESA MISMA HORA (no el total del día completo —
-- eso ya lo hace dashboard_ventas_promedio_dia_semana() para el comparativo
-- de fin de turno). Es una señal de "algo puede estar mal ahora mismo",
-- independiente de la predicción de demanda (F8-03, que anticipa mañana) y
-- del comparativo de temporada alta.

ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS alerta_ventas_bajas_activa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alerta_ventas_bajas_umbral_pct INTEGER NOT NULL DEFAULT 30;

-- Mismo patrón que dashboard_ventas_promedio_dia_semana(): últimos 8 turnos
-- CERRADOS del mismo día de la semana (America/Mexico_City), vía ROW_NUMBER.
-- La diferencia es que aquí cada turno histórico solo cuenta lo cobrado
-- hasta la hora de reloj actual (no su total final), para comparar
-- manzanas con manzanas contra el turno activo que sigue en curso.
CREATE OR REPLACE FUNCTION dashboard_alerta_ventas_bajas()
RETURNS TABLE (
    turno_id INTEGER,
    total_actual NUMERIC,
    promedio_historico NUMERIC,
    turnos_comparados INTEGER
)
LANGUAGE sql STABLE AS $$
    WITH activo AS (
        SELECT id
        FROM turnos
        WHERE estado = 'abierto'
        ORDER BY abierto_en DESC
        LIMIT 1
    ),
    parametros AS (
        SELECT
            EXTRACT(DOW FROM NOW() AT TIME ZONE 'America/Mexico_City')::INTEGER AS dow_actual,
            (NOW() AT TIME ZONE 'America/Mexico_City')::TIME AS hora_actual
    ),
    total_activo AS (
        SELECT activo.id, COALESCE(SUM(m.monto), 0) AS total
        FROM activo
        LEFT JOIN movimientos_caja m ON m.turno_id = activo.id AND m.tipo = 'cobro'
        GROUP BY activo.id
    ),
    turnos_mismo_dow AS (
        SELECT
            t.id,
            ROW_NUMBER() OVER (ORDER BY t.abierto_en DESC) AS rn
        FROM turnos t, parametros
        WHERE t.estado = 'cerrado'
          AND EXTRACT(DOW FROM t.abierto_en AT TIME ZONE 'America/Mexico_City')::INTEGER = parametros.dow_actual
    ),
    totales_a_esa_hora AS (
        SELECT
            tm.id,
            COALESCE(SUM(m.monto), 0) AS total
        FROM turnos_mismo_dow tm
        LEFT JOIN movimientos_caja m
            ON m.turno_id = tm.id
           AND m.tipo = 'cobro'
           AND (m.created_at AT TIME ZONE 'America/Mexico_City')::TIME <= (SELECT hora_actual FROM parametros)
        WHERE tm.rn <= 8
        GROUP BY tm.id
    )
    SELECT
        total_activo.id,
        total_activo.total,
        AVG(totales_a_esa_hora.total),
        COUNT(totales_a_esa_hora.id)::INTEGER
    FROM total_activo
    LEFT JOIN totales_a_esa_hora ON TRUE
    GROUP BY total_activo.id, total_activo.total
$$;
