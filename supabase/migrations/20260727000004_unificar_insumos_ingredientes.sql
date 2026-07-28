-- ============================================================
-- PASO A — Unificar `ingredientes` dentro de `insumos`.
--
-- Rediseño del sistema de recetas (reemplaza por completo el enfoque de
-- 20260727000003_receta_por_opcion.sql — ver Paso C/D para el retiro de
-- receta_insumos.opcion_id y la reescritura de aplicar_consumo_receta()).
--
-- Modelo de dos niveles:
--   1. Receta del insumo derivado (Paso B): insumos que requieren
--      preparación (ej. "Adobada preparada") tienen su propia receta a
--      partir de insumos crudos, se cocinan en lotes y su stock se repone
--      vía producción.
--   2. Porcionado del producto (ya existente, receta_insumos): cuánto de
--      cada insumo (crudo o derivado) usa una unidad de ese producto.
--
-- Este paso solo unifica el catálogo: `ingredientes` (usado hasta ahora
-- solo para el toggle de disponibilidad de modificadores) pasa a ser parte
-- de `insumos`, para que un mismo insumo pueda tener receta propia, stock,
-- costeo Y estar vinculado a una opción de modificador — todo en un solo
-- lugar. insumos.modo_obtencion distingue 'comprado' (se adquiere ya listo,
-- como hasta ahora) de 'derivado' (tiene su propia receta — Paso B).
--
-- IMPORTANTE: la tabla `ingredientes` y la columna
-- opciones_modificador.ingrediente_id NO se borran aquí — quedan intactas
-- como respaldo. El DROP es un paso manual y separado, a ejecutar solo
-- después de confirmar que la migración de datos quedó completa (ver nota
-- al final de este archivo).
-- ============================================================

-- ========================
-- Nuevas columnas en insumos / opciones_modificador
-- ========================

CREATE TYPE modo_obtencion_insumo AS ENUM ('comprado', 'derivado');

ALTER TABLE insumos
    ADD COLUMN modo_obtencion modo_obtencion_insumo NOT NULL DEFAULT 'comprado',
    -- Espejo de ingredientes.disponible: toggle manual de agotado/disponible,
    -- independiente de stock_actual (que sí se usa para costeo/inventario
    -- real). Se conserva como concepto propio en esta migración; unificar
    -- "disponible" con "stock_actual > 0" es una mejora a futuro, no parte
    -- de esta unificación.
    ADD COLUMN disponible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN insumos.modo_obtencion IS
    '''comprado'' = se adquiere ya listo para usar (vía compras). ''derivado'' = tiene su propia receta (insumo_receta, Paso B) y se repone por producción en lote.';
COMMENT ON COLUMN insumos.disponible IS
    'Toggle manual de agotado/disponible para ocultar en el POS las opciones de modificador vinculadas (ver opciones_modificador.insumo_id). Independiente de stock_actual.';

ALTER TABLE opciones_modificador
    ADD COLUMN insumo_id INTEGER REFERENCES insumos(id);

COMMENT ON COLUMN opciones_modificador.insumo_id IS
    'Insumo asociado a esta opción (reemplaza a ingrediente_id, que queda solo como respaldo histórico). Si el insumo no está disponible, la opción se oculta en el POS. También es la clave que usa aplicar_consumo_receta() para saber qué filas de receta_insumos son condicionales a esta opción.';

CREATE INDEX idx_opciones_modificador_insumo ON opciones_modificador(insumo_id);

-- ========================
-- Migración de datos: ingredientes → insumos
--
-- unidad_medida no existía en ingredientes — se asigna por nombre (mejor
-- estimación revisada fila por fila; ninguna tiene compras ni receta
-- todavía, así que es fácilmente corregible después desde Inventario →
-- Insumos si algo no aplica):
--   'kg'    → carnes, guisados y producto a granel (Adobada, Bistec, Queso…)
--   'l'     → aguas frescas / bebidas preparadas en casa (Jamaica, Té…)
--   'pieza' → todo lo demás: embotellados/enlatados individuales, postres,
--             huevo suelto (todo lo no listado en los dos CASE de abajo)
--
-- Se usa una columna puente temporal (ingrediente_id_legado) para poder
-- relacionar cada insumo nuevo con su ingrediente de origen sin depender de
-- que los nombres sean únicos ni de que la tabla insumos esté vacía — se
-- elimina al final de este mismo bloque.
-- ========================

ALTER TABLE insumos ADD COLUMN ingrediente_id_legado INTEGER;

INSERT INTO insumos (nombre, unidad_medida, stock_actual, stock_minimo, activo, modo_obtencion, disponible, ingrediente_id_legado)
SELECT
    ing.nombre,
    CASE
        WHEN ing.nombre IN (
            'Adobada', 'Aguacate', 'Barbacoa', 'Bistec', 'Bistec a la mexicana',
            'Calabacitas con elote', 'Carnaza de cabeza', 'Cayo grueso', 'Champiñones',
            'Chicharron en salsa roja', 'Chicharron seco', 'Chorizo',
            'Costilla en salsa roja', 'Del Dia Birria', 'Del Día Pepena',
            'Deshebrada de res', 'Frijoles', 'Huevo en salsa roja', 'Jamón',
            'Labio de res', 'Lengua de res', 'Libro o garrita', 'Nopales', 'Pancita',
            'Papas con chorizo', 'Pata S/H', 'Pollo a la mexicana', 'Queso',
            'Rajas con crema', 'Ranilla', 'Tocino'
        ) THEN 'kg'
        WHEN ing.nombre IN (
            'Agua para Nescafé', 'Café de olla', 'Jamaica', 'Mixto nara-zanahoria',
            'Naranja', 'Tamarindo', 'Té', 'Zanahoria'
        ) THEN 'l'
        ELSE 'pieza'
    END::unidad_medida,
    0, 0, TRUE, 'comprado', ing.disponible, ing.id
FROM ingredientes ing;

UPDATE opciones_modificador om
SET insumo_id = i.id
FROM insumos i
WHERE i.ingrediente_id_legado = om.ingrediente_id;

ALTER TABLE insumos DROP COLUMN ingrediente_id_legado;

-- ========================
-- PENDIENTE MANUAL (no ejecutar aquí):
-- Una vez confirmado en Catálogo → Ingredientes / Inventario → Insumos que
-- todos los datos migraron correctamente:
--   ALTER TABLE opciones_modificador DROP COLUMN ingrediente_id;
--   DROP TABLE ingredientes;
-- ========================
