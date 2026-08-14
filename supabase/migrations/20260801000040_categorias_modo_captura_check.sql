-- categorias.modo_captura era TEXT plano sin ninguna restricción, a
-- diferencia de productos.modo_captura (enum modo_captura). Verificado
-- contra la base real antes de escribir esto: solo existen 'estandar' (8
-- filas) y 'rapido' (3 filas), sin nulos ni valores fuera de rango — el
-- CHECK no rompe ningún dato existente.
ALTER TABLE categorias
  ADD CONSTRAINT categorias_modo_captura_valido
  CHECK (modo_captura IN ('estandar', 'rapido'));
