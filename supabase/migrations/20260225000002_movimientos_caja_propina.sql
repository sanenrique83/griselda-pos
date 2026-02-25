-- Separar propina del monto de negocio en movimientos de caja
-- La propina va directamente a los meseros y NO es ingreso del negocio.

ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS propina NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN movimientos_caja.propina IS
  'Monto de propina incluido en este cobro. Informativo: va a meseros, no a caja.';
