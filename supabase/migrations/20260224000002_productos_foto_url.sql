-- Agrega campo de imagen a productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS foto_url TEXT;
