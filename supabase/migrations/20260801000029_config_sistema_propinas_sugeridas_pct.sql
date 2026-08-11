-- Varios porcentajes de propina seleccionables al cobrar (chips), en vez del
-- único configurado en propina_sugerida_pct — el mesero elige uno al momento
-- de cobrar en vez de que siempre sea el mismo fijo. Texto separado por comas
-- (ej. '10,12,15,18,20') en vez de un arreglo nativo: mismo patrón simple que
-- ya usa el resto de config_sistema para listas cortas, sin introducir un
-- tipo de columna nuevo solo para esto.
--
-- Nullable a propósito, SIN default — si está NULL, el frontend cae de vuelta
-- a propina_sugerida_pct (que no se toca ni se borra) para que una instalación
-- que ya tenía un único porcentaje configurado lo seguisiga viendo como su
-- único chip hasta que el admin explícitamente configure varios en
-- /mas/permisos. Un DEFAULT aquí habría sobreescrito ese valor previo en
-- filas existentes (ALTER TABLE ADD COLUMN ... DEFAULT sí lo hace en Postgres).
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS propinas_sugeridas_pct TEXT;
