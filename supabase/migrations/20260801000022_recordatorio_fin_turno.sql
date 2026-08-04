-- Recordatorio proactivo de fin de turno programado — no es validación de
-- cierre (eso ya lo cubre turno_diferencia_alerta_monto + el bloqueo de
-- pedidos abiertos existente), es un aviso informativo ANTES de llegar a la
-- hora fin programada.

-- Catálogo de patrones de turno fijos (ej. "Matutino", "Vespertino"),
-- configurado una sola vez desde /mas/permisos.
CREATE TABLE turnos_horario (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE turnos_horario ENABLE ROW LEVEL SECURITY;
-- Mismo patrón que mesas/categorias/productos: lectura para cualquier
-- autenticado (abrirTurno() la necesita), escritura solo admin.
CREATE POLICY "turnos_horario_select_all"  ON turnos_horario FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "turnos_horario_admin_write" ON turnos_horario FOR ALL    USING (es_admin());

-- Emparejamiento automático al abrir turno (abrirTurno()) — NULL si no hay
-- coincidencia clara (ninguna o más de una) contra los turnos_horario activos.
ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS turno_horario_id INTEGER REFERENCES turnos_horario(id);

ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS recordatorio_fin_turno_activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recordatorio_fin_turno_minutos INTEGER NOT NULL DEFAULT 20;
