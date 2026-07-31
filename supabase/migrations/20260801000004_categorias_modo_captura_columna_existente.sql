-- Documenta una columna que ya existe en producción pero nunca tuvo
-- migración (se agregó directo en la base en algún momento, fuera de
-- control de versiones — ver auditoría de 2026-07-31). Tipo real
-- confirmado por introspección directa de la base: TEXT NOT NULL DEFAULT
-- 'estandar', NO el enum `modo_captura` que sí usa productos.modo_captura.
--
-- Esa inconsistencia de tipos entre las dos columnas es real (esta no
-- valida los mismos 2 valores que el enum) y queda pendiente como decisión
-- aparte — cambiar el tipo de una columna ya en uso en producción es más
-- riesgoso que documentar lo que ya hay, así que NO se resuelve aquí.
ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS modo_captura TEXT NOT NULL DEFAULT 'estandar';
