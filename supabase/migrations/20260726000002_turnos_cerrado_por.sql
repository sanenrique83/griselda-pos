-- ============================================================
-- TURNOS — registrar quién cerró el turno
-- usuario_id captura quién lo ABRIÓ y nunca se actualiza al cerrar.
-- Se agrega cerrado_por para poder atribuir el cierre por separado
-- (turnos cerrados antes de esta migración quedan con cerrado_por NULL).
-- ============================================================

ALTER TABLE turnos
  ADD COLUMN cerrado_por UUID REFERENCES auth.users(id);
