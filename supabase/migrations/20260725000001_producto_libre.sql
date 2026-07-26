-- ========================
-- PRODUCTO LIBRE
-- Permite capturar un ítem improvisado (nombre + precio, una sola vez) sin
-- guardarlo en el catálogo. Se apoya en un producto/categoría "placeholder"
-- ocultos (activo=false) que satisfacen el FK de pedido_productos.producto_id,
-- y en la columna nombre_libre que sobreescribe el nombre a mostrar en
-- comanda, ticket de cocina y recibo.
-- ========================

ALTER TABLE pedido_productos
  ADD COLUMN nombre_libre TEXT;

-- Categoría oculta — activa=false para que nunca aparezca en Catálogo ni en
-- el menú del POS (esas pantallas ya filtran por activa/activo=true).
INSERT INTO categorias (nombre, orden, activa)
VALUES ('Interno — no mostrar', 9999, false)
RETURNING id;

-- Producto placeholder oculto, referenciando la categoría anterior.
INSERT INTO productos (categoria_id, nombre, precio, activo, disponible)
SELECT id, 'Producto libre (placeholder)', 0, false, true
FROM categorias WHERE nombre = 'Interno — no mostrar'
RETURNING id;

-- Referencia rápida desde config_sistema, para que el código no dependa de
-- un ID mágico hardcodeado.
ALTER TABLE config_sistema
  ADD COLUMN producto_libre_id INTEGER REFERENCES productos(id);

UPDATE config_sistema
SET producto_libre_id = (
  SELECT p.id FROM productos p
  JOIN categorias c ON c.id = p.categoria_id
  WHERE c.nombre = 'Interno — no mostrar'
  LIMIT 1
)
WHERE id = 1;
