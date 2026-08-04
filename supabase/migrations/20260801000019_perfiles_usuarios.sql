-- Administración de usuarios (/mas/usuarios). perfiles.activo ya existía
-- desde el esquema inicial (20260223000001) — desactivar preserva historial,
-- nunca se hace DELETE de un perfil. Solo faltan estos dos campos.
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS fecha_contratacion DATE;
