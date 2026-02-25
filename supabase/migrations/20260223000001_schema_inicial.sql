-- ============================================================
-- Griselda POS — Migración 001: Schema inicial
-- La Menudería, El Arenal, Jalisco
-- ============================================================

-- ========================
-- ENUMS
-- ========================

CREATE TYPE estado_mesa            AS ENUM ('libre', 'ocupada');
CREATE TYPE forma_mesa             AS ENUM ('rectangulo', 'cuadrado', 'circulo');
CREATE TYPE tamano_mesa            AS ENUM ('chico', 'medio', 'grande');
CREATE TYPE ancho_papel            AS ENUM ('58mm', '80mm');
CREATE TYPE modo_captura           AS ENUM ('estandar', 'rapido');
CREATE TYPE estado_turno           AS ENUM ('abierto', 'cerrado');
CREATE TYPE tipo_pedido            AS ENUM ('mesa', 'llevar');
CREATE TYPE estado_pedido          AS ENUM ('abierto', 'cerrado');
CREATE TYPE estado_subpedido       AS ENUM ('activo', 'pagado');
CREATE TYPE estado_producto_pedido AS ENUM ('pendiente', 'enviado', 'cancelado');
CREATE TYPE tipo_movimiento_caja   AS ENUM ('cobro', 'fondo', 'retiro', 'ajuste', 'cancelacion');
CREATE TYPE metodo_pago            AS ENUM ('efectivo', 'tarjeta', 'transferencia');
CREATE TYPE tipo_descuento         AS ENUM ('porcentaje', 'monto_fijo', 'corteria');
CREATE TYPE rol_usuario            AS ENUM ('admin', 'mesero');

-- ========================
-- PERFILES DE USUARIO
-- Extiende auth.users de Supabase con el rol del sistema.
-- ========================

CREATE TABLE perfiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre     TEXT NOT NULL,
    rol        rol_usuario NOT NULL DEFAULT 'mesero',
    activo     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-crear perfil al registrar usuario en Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO perfiles (id, nombre, rol)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario, 'mesero')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Funciones de ayuda para RLS
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN AS $$
    SELECT rol = 'admin' FROM perfiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================
-- CONFIG_SISTEMA
-- Fila única. Representa el negocio y sus parámetros globales.
-- ========================

CREATE TABLE config_sistema (
    id                     INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    negocio_nombre         TEXT NOT NULL DEFAULT 'La Menudería',
    negocio_descripcion    TEXT DEFAULT 'Menudo y tacos de guisado',
    negocio_direccion      TEXT DEFAULT 'Lázaro Cárdenas 283B',
    negocio_ciudad         TEXT DEFAULT 'El Arenal, Jalisco',
    negocio_telefono       TEXT,
    negocio_rfc            TEXT,       -- opcional, para facturación futura
    negocio_logo_url       TEXT,       -- Supabase Storage
    moneda                 TEXT NOT NULL DEFAULT 'MXN',
    iva_incluido           BOOLEAN NOT NULL DEFAULT TRUE,    -- precio ya incluye IVA
    -- Permisos configurables por operación
    cancelaciones_mesero   BOOLEAN NOT NULL DEFAULT FALSE,
    descuentos_mesero      BOOLEAN NOT NULL DEFAULT FALSE,
    descuento_max_pct      NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    corteria_requiere_nota BOOLEAN NOT NULL DEFAULT TRUE,
    propina_sugerida_pct   NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    impresion_activa       BOOLEAN NOT NULL DEFAULT TRUE     -- toggle global de impresión
);

INSERT INTO config_sistema (id) VALUES (1);

-- ========================
-- AREAS
-- Zonas del restaurante: Interior, Terraza, Barra, etc.
-- ========================

CREATE TABLE areas (
    id     SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    orden  INTEGER NOT NULL DEFAULT 0,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

-- ========================
-- MESAS
-- pos_x, pos_y, rotacion, forma, tamano son nullable:
-- no requieren migración cuando se implemente el mapa visual en Fase 2.
-- ========================

CREATE TABLE mesas (
    id       SERIAL PRIMARY KEY,
    area_id  INTEGER REFERENCES areas(id),
    numero   INTEGER NOT NULL UNIQUE,
    nombre   TEXT,          -- etiqueta opcional ("Mesa del rincón")
    capacidad INTEGER,
    estado   estado_mesa NOT NULL DEFAULT 'libre',
    activa   BOOLEAN NOT NULL DEFAULT TRUE,
    -- Fase 2: mapa visual (todos nullable)
    pos_x    INTEGER,
    pos_y    INTEGER,
    rotacion INTEGER DEFAULT 0,
    forma    forma_mesa DEFAULT 'rectangulo',
    tamano   tamano_mesa DEFAULT 'medio'
);

-- ========================
-- IMPRESORAS
-- Una impresora física puede cubrir varios grupos lógicos (Cocina, Barra).
-- ========================

CREATE TABLE impresoras (
    id                        SERIAL PRIMARY KEY,
    nombre                    TEXT NOT NULL,
    ip                        TEXT NOT NULL,
    puerto                    INTEGER NOT NULL DEFAULT 9100,
    ancho_papel               ancho_papel NOT NULL DEFAULT '80mm',
    activa                    BOOLEAN NOT NULL DEFAULT TRUE,
    -- Cinco toggles de configuración (espejo de Loyverse)
    imprimir_recibos_cuentas  BOOLEAN NOT NULL DEFAULT TRUE,
    imprimir_pedidos          BOOLEAN NOT NULL DEFAULT TRUE,
    imprimir_automaticamente  BOOLEAN NOT NULL DEFAULT TRUE,
    un_articulo_por_ticket    BOOLEAN NOT NULL DEFAULT FALSE,
    agrupar_identicos         BOOLEAN NOT NULL DEFAULT FALSE  -- "3x Refresco" en lugar de tres líneas
);

-- ========================
-- GRUPOS_IMPRESORA
-- Función lógica desacoplada del dispositivo físico.
-- "Cocina" y "Barra" pueden apuntar a la misma impresora física.
-- Al agregar segunda impresora, solo se cambia impresora_id en "Barra".
-- ========================

CREATE TABLE grupos_impresora (
    id           SERIAL PRIMARY KEY,
    nombre       TEXT NOT NULL,        -- 'Cocina', 'Barra de bebidas'
    impresora_id INTEGER NOT NULL REFERENCES impresoras(id),
    activo       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ========================
-- CATEGORIAS
-- Cada categoría enruta sus tickets al grupo de impresora correspondiente.
-- ========================

CREATE TABLE categorias (
    id                  SERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL,
    grupo_impresora_id  INTEGER REFERENCES grupos_impresora(id),
    orden               INTEGER NOT NULL DEFAULT 0,
    activa              BOOLEAN NOT NULL DEFAULT TRUE
);

-- ========================
-- PRODUCTOS
-- es_combo=TRUE: el producto es un combo fijo con precio independiente.
-- modo_captura='rapido': usa contadores por opción (ej. tacos de guisado).
-- disponible: toggle diario (agotado del día).
-- activo: baja permanente del catálogo.
-- ========================

CREATE TABLE productos (
    id                       SERIAL PRIMARY KEY,
    categoria_id             INTEGER NOT NULL REFERENCES categorias(id),
    nombre                   TEXT NOT NULL,
    descripcion              TEXT,
    precio                   NUMERIC(10,2) NOT NULL,
    emoji                    TEXT,
    foto_url                 TEXT,                              -- Supabase Storage
    es_combo                 BOOLEAN NOT NULL DEFAULT FALSE,
    modo_captura             modo_captura NOT NULL DEFAULT 'estandar',
    disponible               BOOLEAN NOT NULL DEFAULT TRUE,
    disponible_actualizado_en TIMESTAMPTZ,                     -- timestamp exacto del último toggle
    activo                   BOOLEAN NOT NULL DEFAULT TRUE,    -- FALSE = retirado del menú
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- COMBO_PRODUCTOS
-- Componentes de un combo. combo_id → productos.id con es_combo=TRUE.
-- incluye_extras: si el componente acepta modificadores de precio adicional.
-- ========================

CREATE TABLE combo_productos (
    id             SERIAL PRIMARY KEY,
    combo_id       INTEGER NOT NULL REFERENCES productos(id),
    producto_id    INTEGER NOT NULL REFERENCES productos(id),  -- componente
    cantidad       INTEGER NOT NULL DEFAULT 1,
    incluye_extras BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT combo_componente_unico UNIQUE (combo_id, producto_id)
);

-- ========================
-- GRUPOS_MODIFICADORES
-- padre_opcion_id: NULL = siempre visible / valor = condicional (se muestra
--   solo si esa opción del padre está seleccionada). FK circular resuelta abajo.
-- maximo=99 convención para "elige varios sin límite".
-- ========================

CREATE TABLE grupos_modificadores (
    id               SERIAL PRIMARY KEY,
    producto_id      INTEGER NOT NULL REFERENCES productos(id),
    nombre           TEXT NOT NULL,        -- 'Color', 'Complemento', 'Extras', 'Tamaño'
    requerido        BOOLEAN NOT NULL DEFAULT FALSE,
    minimo           INTEGER NOT NULL DEFAULT 0,
    maximo           INTEGER NOT NULL DEFAULT 1,
    orden            INTEGER NOT NULL DEFAULT 0,
    padre_opcion_id  INTEGER,              -- FK circular añadida tras opciones_modificador
    mostrar_en_rapido BOOLEAN NOT NULL DEFAULT TRUE
);

-- ========================
-- OPCIONES_MODIFICADOR
-- Opciones dentro de un grupo. precio_extra se copia como snapshot al pedir.
-- ========================

CREATE TABLE opciones_modificador (
    id           SERIAL PRIMARY KEY,
    grupo_id     INTEGER NOT NULL REFERENCES grupos_modificadores(id),
    nombre       TEXT NOT NULL,            -- 'Rojos', 'Huevo sencillo', 'Grande'
    precio_extra NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    orden        INTEGER NOT NULL DEFAULT 0,
    activa       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Resolver FK circular: grupo condicional visible solo si esta opción está activa
ALTER TABLE grupos_modificadores
    ADD CONSTRAINT fk_padre_opcion
    FOREIGN KEY (padre_opcion_id) REFERENCES opciones_modificador(id);

-- ========================
-- TURNOS
-- Solo Admin puede abrir/cerrar. efectivo_contado y diferencia se llenan al cierre.
-- ========================

CREATE TABLE turnos (
    id               SERIAL PRIMARY KEY,
    usuario_id       UUID NOT NULL REFERENCES auth.users(id),
    fondo_inicial    NUMERIC(10,2) NOT NULL,
    efectivo_contado NUMERIC(10,2),        -- ingresado por Admin al cerrar
    diferencia       NUMERIC(10,2),        -- efectivo_contado - efectivo_teorico
    estado           estado_turno NOT NULL DEFAULT 'abierto',
    abierto_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en       TIMESTAMPTZ,
    notas            TEXT
);

-- ========================
-- PEDIDOS
-- mesa_id=NULL cuando tipo='llevar'.
-- cliente_nombre, cliente_telefono, hora_recogida: solo para tipo='llevar'.
-- ========================

CREATE TABLE pedidos (
    id              SERIAL PRIMARY KEY,
    turno_id        INTEGER NOT NULL REFERENCES turnos(id),
    mesa_id         INTEGER REFERENCES mesas(id),
    mesero_id       UUID NOT NULL REFERENCES auth.users(id),
    tipo            tipo_pedido NOT NULL DEFAULT 'mesa',
    estado          estado_pedido NOT NULL DEFAULT 'abierto',
    num_comensales  INTEGER NOT NULL DEFAULT 1,
    -- Campos para tipo='llevar'
    cliente_nombre  TEXT,
    cliente_telefono TEXT,
    hora_recogida   TIME,
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en      TIMESTAMPTZ,
    CONSTRAINT mesa_requerida_si_no_llevar
        CHECK (tipo = 'llevar' OR mesa_id IS NOT NULL)
);

-- ========================
-- SUBPEDIDOS
-- Un subpedido por comensal. comensal_numero es único dentro del pedido.
-- mesero_id propio: trazabilidad de quién atendió cada comensal (Escenario C).
-- ========================

CREATE TABLE subpedidos (
    id               SERIAL PRIMARY KEY,
    pedido_id        INTEGER NOT NULL REFERENCES pedidos(id),
    mesero_id        UUID NOT NULL REFERENCES auth.users(id),
    comensal_numero  INTEGER NOT NULL,
    nombre           TEXT,              -- nombre opcional del comensal
    estado           estado_subpedido NOT NULL DEFAULT 'activo',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comensal_unico_por_pedido UNIQUE (pedido_id, comensal_numero)
);

-- ========================
-- PEDIDO_PRODUCTOS
-- precio_unit es INMUTABLE: snapshot del precio al momento de agregar.
-- Cambios en productos.precio no afectan pedidos ya abiertos.
-- ========================

CREATE TABLE pedido_productos (
    id            SERIAL PRIMARY KEY,
    subpedido_id  INTEGER NOT NULL REFERENCES subpedidos(id),
    producto_id   INTEGER NOT NULL REFERENCES productos(id),
    cantidad      INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unit   NUMERIC(10,2) NOT NULL,   -- snapshot inmutable
    estado        estado_producto_pedido NOT NULL DEFAULT 'pendiente',
    notas         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- PEDIDO_PRODUCTO_OPCIONES
-- precio_extra también es snapshot: el precio del modificador al momento del pedido.
-- ========================

CREATE TABLE pedido_producto_opciones (
    id                 SERIAL PRIMARY KEY,
    pedido_producto_id INTEGER NOT NULL REFERENCES pedido_productos(id),
    opcion_id          INTEGER NOT NULL REFERENCES opciones_modificador(id),
    precio_extra       NUMERIC(10,2) NOT NULL   -- snapshot inmutable
);

-- ========================
-- CANCELACIONES
-- Registro de auditoría. Solo productos en estado 'enviado' pueden cancelarse.
-- Genera movimiento_caja tipo 'cancelacion' con monto negativo.
-- ========================

CREATE TABLE cancelaciones (
    id                 SERIAL PRIMARY KEY,
    pedido_producto_id INTEGER NOT NULL REFERENCES pedido_productos(id),
    usuario_id         UUID REFERENCES auth.users(id),
    motivo             TEXT NOT NULL,
    monto_afectado     NUMERIC(10,2) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- DESCUENTOS
-- Aplica a nivel pedido (toda la mesa) o subpedido (un comensal).
-- tipo='corteria': 100% del monto, requiere nota si corteria_requiere_nota=TRUE.
-- ========================

CREATE TABLE descuentos (
    id               SERIAL PRIMARY KEY,
    pedido_id        INTEGER REFERENCES pedidos(id),
    subpedido_id     INTEGER REFERENCES subpedidos(id),
    usuario_id       UUID REFERENCES auth.users(id),
    tipo             tipo_descuento NOT NULL,
    valor            NUMERIC(10,2) NOT NULL,   -- el porcentaje o monto ingresado
    monto_calculado  NUMERIC(10,2) NOT NULL,   -- el monto real descontado en pesos
    motivo           TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT descuento_necesita_nivel
        CHECK (pedido_id IS NOT NULL OR subpedido_id IS NOT NULL)
);

-- ========================
-- MOVIMIENTOS_CAJA
-- Registro principal de caja. Un cobro de $300 mixto genera UN movimiento_caja
-- más N registros en 'pagos'. efectivo_recibido y cambio solo aplican en cobros
-- donde hay efectivo (el cambio se calcula solo sobre la parte en efectivo).
-- ========================

CREATE TABLE movimientos_caja (
    id                SERIAL PRIMARY KEY,
    turno_id          INTEGER NOT NULL REFERENCES turnos(id),
    tipo              tipo_movimiento_caja NOT NULL,
    monto             NUMERIC(10,2) NOT NULL,
    efectivo_recibido NUMERIC(10,2),   -- lo que entregó el cliente
    cambio            NUMERIC(10,2),   -- vuelto calculado
    notas             TEXT,
    usuario_id        UUID REFERENCES auth.users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- PAGOS
-- Detalle de métodos en un cobro con pago mixto.
-- Un movimiento_caja → N pagos (uno por método utilizado).
-- referencia: últimos 4 dígitos de tarjeta, clave SPEI, etc.
-- ========================

CREATE TABLE pagos (
    id            SERIAL PRIMARY KEY,
    movimiento_id INTEGER NOT NULL REFERENCES movimientos_caja(id),
    metodo_pago   metodo_pago NOT NULL,
    monto         NUMERIC(10,2) NOT NULL,
    referencia    TEXT
);

-- ========================
-- COBRO_SUBPEDIDOS
-- Qué subpedidos cubre cada movimiento de cobro.
-- Escenario B (uno paga por varios): 1 movimiento → N cobro_subpedidos.
-- Escenario C (dividido): N movimientos → cada uno con sus cobro_subpedidos.
-- ========================

CREATE TABLE cobro_subpedidos (
    id              SERIAL PRIMARY KEY,
    movimiento_id   INTEGER NOT NULL REFERENCES movimientos_caja(id),
    subpedido_id    INTEGER NOT NULL REFERENCES subpedidos(id),
    monto_aplicado  NUMERIC(10,2) NOT NULL,
    CONSTRAINT cobro_subpedido_unico UNIQUE (movimiento_id, subpedido_id)
);

-- ========================
-- ÍNDICES
-- Solo en columnas de consulta frecuente. Sin over-engineering.
-- ========================

-- Mesas
CREATE INDEX idx_mesas_estado  ON mesas(estado);
CREATE INDEX idx_mesas_area    ON mesas(area_id);

-- Productos
CREATE INDEX idx_productos_categoria   ON productos(categoria_id);
CREATE INDEX idx_productos_disponible  ON productos(disponible) WHERE disponible = FALSE;

-- Pedidos
CREATE INDEX idx_pedidos_turno  ON pedidos(turno_id);
CREATE INDEX idx_pedidos_mesa   ON pedidos(mesa_id) WHERE mesa_id IS NOT NULL;
CREATE INDEX idx_pedidos_estado ON pedidos(estado);

-- Subpedidos y productos en pedido
CREATE INDEX idx_subpedidos_pedido         ON subpedidos(pedido_id);
CREATE INDEX idx_pedido_productos_subpedido ON pedido_productos(subpedido_id);
CREATE INDEX idx_pedido_productos_estado    ON pedido_productos(estado);

-- Caja y pagos
CREATE INDEX idx_movimientos_turno ON movimientos_caja(turno_id);
CREATE INDEX idx_movimientos_tipo  ON movimientos_caja(tipo);
CREATE INDEX idx_pagos_movimiento  ON pagos(movimiento_id);

-- Modificadores
CREATE INDEX idx_grupos_mod_producto ON grupos_modificadores(producto_id);
CREATE INDEX idx_opciones_grupo      ON opciones_modificador(grupo_id);
