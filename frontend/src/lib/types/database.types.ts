// Tipos del schema de Griselda POS.
// Regenerar cuando cambie el schema:
//   npm run types   (requiere Supabase CLI y proyecto local activo)

// ========================
// Enums
// ========================

export type EstadoMesa            = 'libre' | 'ocupada'
export type FormaMesa             = 'rectangulo' | 'cuadrado' | 'circulo'
export type TamanoMesa            = 'chico' | 'medio' | 'grande'
export type AnchoPapel            = '58mm' | '80mm'
export type ModoCaptura           = 'estandar' | 'rapido'
export type EstadoTurno           = 'abierto' | 'cerrado'
export type TipoPedido            = 'mesa' | 'llevar'
export type EstadoPedido          = 'abierto' | 'cerrado'
export type EstadoSubpedido       = 'activo' | 'pagado'
export type EstadoProductoPedido  = 'pendiente' | 'enviado' | 'cancelado'
export type TipoMovimientoCaja    = 'cobro' | 'fondo' | 'retiro' | 'ajuste' | 'cancelacion'
export type MetodoPago            = 'efectivo' | 'tarjeta' | 'transferencia'
export type TipoDescuento         = 'porcentaje' | 'monto_fijo' | 'corteria'
export type RolUsuario            = 'admin' | 'mesero'

// ========================
// Filas de tablas (Row types)
// ========================

export interface Perfil {
  id: string          // UUID
  nombre: string
  rol: RolUsuario
  activo: boolean
  created_at: string
}

export interface ConfigSistema {
  id: 1
  negocio_nombre: string
  negocio_descripcion: string | null
  negocio_direccion: string | null
  negocio_ciudad: string | null
  negocio_telefono: string | null
  negocio_rfc: string | null
  negocio_logo_url: string | null
  moneda: string
  iva_incluido: boolean
  cancelaciones_mesero: boolean
  descuentos_mesero: boolean
  descuento_max_pct: number
  corteria_requiere_nota: boolean
  propina_sugerida_pct: number
  impresion_activa: boolean
  transferencia_banco: string | null
  transferencia_clabe: string | null
  transferencia_titular: string | null
  cancelar_pedido_mesero: boolean
  ver_dashboard_mesero: boolean
}

export interface Area {
  id: number
  nombre: string
  orden: number
  activa: boolean
}

export interface Mesa {
  id: number
  area_id: number | null
  numero: number
  nombre: string | null
  capacidad: number | null
  estado: EstadoMesa
  activa: boolean
  pos_x: number | null
  pos_y: number | null
  rotacion: number | null
  forma: FormaMesa | null
  tamano: TamanoMesa | null
}

export interface Impresora {
  id: number
  nombre: string
  ip: string
  puerto: number
  ancho_papel: AnchoPapel
  activa: boolean
  imprimir_recibos_cuentas: boolean
  imprimir_pedidos: boolean
  imprimir_automaticamente: boolean
  un_articulo_por_ticket: boolean
  agrupar_identicos: boolean
}

export interface GrupoImpresora {
  id: number
  nombre: string
  impresora_id: number
  activo: boolean
}

export interface Categoria {
  id: number
  nombre: string
  grupo_impresora_id: number | null
  orden: number
  activa: boolean
}

export interface Producto {
  id: number
  categoria_id: number
  nombre: string
  descripcion: string | null
  precio: number
  emoji: string | null
  foto_url: string | null
  es_combo: boolean
  modo_captura: ModoCaptura
  disponible: boolean
  disponible_actualizado_en: string | null
  activo: boolean
  created_at: string
}

export interface ComboProducto {
  id: number
  combo_id: number
  producto_id: number
  cantidad: number
  incluye_extras: boolean
}

export interface GrupoModificador {
  id: number
  producto_id: number
  nombre: string
  requerido: boolean
  minimo: number
  maximo: number
  orden: number
  padre_opcion_id: number | null
  mostrar_en_rapido: boolean
}

export interface OpcionModificador {
  id: number
  grupo_id: number
  nombre: string
  precio_extra: number
  orden: number
  activa: boolean
}

export interface Turno {
  id: number
  usuario_id: string
  fondo_inicial: number
  efectivo_contado: number | null
  diferencia: number | null
  estado: EstadoTurno
  abierto_en: string
  cerrado_en: string | null
  notas: string | null
}

export interface Pedido {
  id: number
  turno_id: number
  mesa_id: number | null
  mesero_id: string
  tipo: TipoPedido
  estado: EstadoPedido
  num_comensales: number
  cliente_nombre: string | null
  cliente_telefono: string | null
  hora_recogida: string | null
  notas: string | null
  created_at: string
  cerrado_en: string | null
}

export interface Subpedido {
  id: number
  pedido_id: number
  mesero_id: string
  comensal_numero: number
  nombre: string | null
  estado: EstadoSubpedido
  created_at: string
}

export interface PedidoProducto {
  id: number
  subpedido_id: number
  producto_id: number
  cantidad: number
  precio_unit: number   // snapshot inmutable
  estado: EstadoProductoPedido
  notas: string | null
  created_at: string
}

export interface PedidoProductoOpcion {
  id: number
  pedido_producto_id: number
  opcion_id: number
  precio_extra: number  // snapshot inmutable
}

export interface Cancelacion {
  id: number
  pedido_producto_id: number
  usuario_id: string | null
  motivo: string
  monto_afectado: number
  created_at: string
}

export interface Descuento {
  id: number
  pedido_id: number | null
  subpedido_id: number | null
  usuario_id: string | null
  tipo: TipoDescuento
  valor: number
  monto_calculado: number
  motivo: string | null
  created_at: string
}

export interface MovimientoCaja {
  id: number
  turno_id: number
  tipo: TipoMovimientoCaja
  monto: number
  efectivo_recibido: number | null
  cambio: number | null
  notas: string | null
  usuario_id: string | null
  created_at: string
}

export interface Pago {
  id: number
  movimiento_id: number
  metodo_pago: MetodoPago
  monto: number
  referencia: string | null
}

export interface CobroSubpedido {
  id: number
  movimiento_id: number
  subpedido_id: number
  monto_aplicado: number
}
