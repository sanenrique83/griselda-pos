-- Permitir lectura de config_sistema a todos los usuarios autenticados.
-- Necesario para que meseros puedan leer propina_sugerida_pct, impresion_activa,
-- datos bancarios, etc. al abrir la pantalla de cobro.
-- El UPDATE sigue restringido a admins (política existente "config_admin_update").

DROP POLICY IF EXISTS "config_admin_select" ON config_sistema;

CREATE POLICY "config_authenticated_select"
    ON config_sistema FOR SELECT
    USING (auth.role() = 'authenticated');
