-- Reloj de entrada/salida del personal, sin nómina integrada.

CREATE TABLE asistencia (
    id          SERIAL PRIMARY KEY,
    usuario_id  UUID NOT NULL REFERENCES auth.users(id),
    entrada     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    salida      TIMESTAMPTZ,
    notas       TEXT
);

CREATE INDEX idx_asistencia_usuario ON asistencia(usuario_id);
CREATE INDEX idx_asistencia_entrada ON asistencia(entrada);

-- Un usuario no puede tener dos entradas abiertas (sin salida) a la vez —
-- garantiza a nivel de base de datos lo que la UI ya evita, incluso bajo
-- doble clic o dos pestañas abiertas al mismo tiempo.
CREATE UNIQUE INDEX idx_asistencia_entrada_abierta ON asistencia(usuario_id) WHERE salida IS NULL;

ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado ve/inserta/actualiza su propia asistencia; solo
-- admin ve/edita la de los demás. Sin policy de INSERT para admin a nombre
-- de otro usuario (no se pidió) ni de DELETE (tampoco se pidió).
CREATE POLICY "asistencia_select_propia_o_admin" ON asistencia
    FOR SELECT USING (usuario_id = auth.uid() OR es_admin());

CREATE POLICY "asistencia_insert_propia" ON asistencia
    FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "asistencia_update_propia_o_admin" ON asistencia
    FOR UPDATE USING (usuario_id = auth.uid() OR es_admin());
