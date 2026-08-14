-- Productos favoritos: sección destacada al inicio del menú del POS
-- (VistaMenu.tsx), controlable desde /mas/permisos.
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS favorito BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS mostrar_favoritos BOOLEAN NOT NULL DEFAULT true;
