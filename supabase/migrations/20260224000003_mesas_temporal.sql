-- Agrega flag para mesas temporales (compartir mesa)
ALTER TABLE mesas
  ADD COLUMN IF NOT EXISTS temporal BOOLEAN NOT NULL DEFAULT FALSE;
