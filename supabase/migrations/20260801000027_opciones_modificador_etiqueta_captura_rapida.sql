-- Etiqueta opcional de categoría para Modo captura rápida (ej. "Clásicos",
-- "Guisados", "Vegetarianos") — antes las chips de categoría se armaban a
-- partir de grupos_modificadores.mostrar_en_rapido separados, pero en la
-- práctica casi siempre hay un solo grupo activo con ese flag, así que las
-- chips nunca tenían más de una opción real. Ahora la categorización es por
-- opción individual, sin importar de qué grupo venga: las chips de
-- SheetCapturaPida se arman a partir de las etiquetas distintas presentes
-- entre las opciones del/los grupo(s) mostrar_en_rapido del producto (más
-- "Todas"). Nullable a propósito — una opción sin etiqueta solo aparece en
-- "Todas", sin quedar fuera de ninguna chip específica.
ALTER TABLE opciones_modificador
  ADD COLUMN IF NOT EXISTS etiqueta_captura_rapida TEXT;
