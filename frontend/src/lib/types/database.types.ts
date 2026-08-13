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
export type TipoPedido            = 'mesa' | 'llevar' | 'mostrador'
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
  telefono: string | null
  fecha_contratacion: string | null // DATE — 'YYYY-MM-DD'
  // PIN rápido (/cambiar-usuario) — nunca expuesto vía RLS a ningún
  // cliente, solo leído/escrito por Server Actions vía el cliente admin.
  pin_hash: string | null
  pin_intentos_fallidos: number
  pin_bloqueado_hasta: string | null
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
  // Varios porcentajes seleccionables al cobrar, texto separado por comas
  // (ej. '10,12,15,18,20') — null cae de vuelta a propina_sugerida_pct como
  // único chip (ver CobroShell.tsx). No reemplaza la columna anterior en la
  // base, solo en la UI de /mas/permisos.
  propinas_sugeridas_pct: string | null
  impresion_activa: boolean
  transferencia_banco: string | null
  transferencia_clabe: string | null
  transferencia_titular: string | null
  cancelar_pedido_mesero: boolean
  ver_dashboard_mesero: boolean
  // Panel del turno en /mesas: sin este permiso, un mesero solo ve Mesas
  // ocupadas/Clientes/Tiempo promedio — Ticket promedio y Cobro pendiente
  // quedan ocultos (Admin siempre ve los 5, sin importar este valor).
  panel_turno_mesero_financiero: boolean
  timeout_inactividad_minutos: number
  orden_productos: 'alfabetico_asc' | 'alfabetico_desc' | 'personalizado'
  orden_modificadores: 'alfabetico_asc' | 'alfabetico_desc' | 'personalizado' | 'popularidad'
  // Días hacia atrás que considera el modo 'popularidad' de orden_modificadores
  // al contar cuántas veces se eligió cada opción — ver
  // popularidad_opciones_modificador() y ordenarPorPopularidad().
  orden_popularidad_dias: number
  alerta_mesa_sin_atender: boolean
  alerta_mesa_sin_atender_minutos: number
  // Temporizador de mesa en vivo (F9-03): umbral (minutos) a partir del cual
  // se colorea el texto del tiempo transcurrido — independiente del
  // semáforo de arriba (ese es por falta de captura, esto es el tiempo en sí).
  tiempo_mesa_alerta_minutos: number
  // Alerta de ventas bajas en tiempo real (F9-06): si el total cobrado del
  // turno activo hasta ahora está `alerta_ventas_bajas_umbral_pct`% o más
  // por debajo del promedio histórico para este mismo día de la semana a
  // esta misma hora, se muestra un aviso — ver dashboard_alerta_ventas_bajas().
  alerta_ventas_bajas_activa: boolean
  alerta_ventas_bajas_umbral_pct: number
  // Umbral (monto en $) de diferencia entre efectivo contado y teórico al
  // cerrar turno que dispara la advertencia no bloqueante de doble confirmación.
  turno_diferencia_alerta_monto: number
  // Texto del ticket impreso (TicketConfigShell, /mas/configuracion) — ya
  // existían en la base antes de tener migración propia, ver
  // 20260801000005_config_sistema_ticket_columnas_existentes.sql.
  ticket_nombre: string | null
  // Subtítulo opcional debajo del nombre, en fuente normal (ver TicketConfigShell).
  ticket_subtitulo: string | null
  ticket_direccion: string | null
  ticket_telefono: string | null
  ticket_rfc: string | null
  ticket_linea1: string | null
  ticket_linea2: string | null
  ticket_pie: string | null
  ticket_pie2: string | null
  // Cuántos modificadores caben por línea en tickets impresos (cocina y
  // cliente) — 1 = uno por línea (comportamiento de siempre).
  modificadores_por_linea: number
  // 'lista'/'agrupado' (existentes, gobernados por modificadores_por_linea)
  // vs. 'texto_natural' (frase armada con construirDescripcionNatural() —
  // ver lib/descripcionNatural.ts).
  formato_modificadores_ticket: 'lista' | 'agrupado' | 'texto_natural'
  // Aviso de precuenta impresa hace tiempo sin cobro (independiente del
  // semáforo de color de la mesa) — ver pedidos.precuenta_impresa_en.
  alerta_precuenta_activa: boolean
  alerta_precuenta_minutos: number
  // Recordatorio proactivo de fin de turno programado (turnos_horario) — no
  // es validación de cierre, es un aviso antes de llegar a la hora fin.
  recordatorio_fin_turno_activo: boolean
  recordatorio_fin_turno_minutos: number
  // Restringe el paso FINAL de cobrar (botón "Cobrar $X" en CobroShell) a
  // admin — un mesero con este permiso activo puede seguir abriendo
  // /cobro/[pedidoId], ver el total, aplicar descuento e imprimir
  // precuenta. Puente hacia un futuro rol "Cajero" real: cuando exista el
  // sistema de permisos por rol, la fuente de la verificación debe migrar
  // de esta columna a esa tabla, sin mover el punto donde se verifica (ver
  // CobroShell.tsx).
  cobro_solo_admin: boolean
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
  asientos_horario: boolean
  fuera_de_servicio: boolean
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
  orden: number
  created_at: string
  // Disponibilidad automática por horario (F9-04), independiente del toggle
  // manual `disponible` — NULL en ambos = sin restricción.
  horario_desde: string | null
  horario_hasta: string | null
}

export interface ComboProducto {
  id: number
  combo_id: number
  producto_id: number
  cantidad: number
  incluye_extras: boolean
}

// Combos electivos (F7-04) — distinto de ComboProducto (componentes fijos):
// aquí el cliente elige una opción por fila de combo_slots.
export interface ComboSlot {
  id: number
  combo_id: number
  nombre: string
  requerido: boolean
}

export interface ComboSlotOpcion {
  id: number
  slot_id: number
  producto_id: number
}

export interface GrupoModificador {
  id: number
  producto_id: number
  nombre: string
  requerido: boolean
  minimo: number
  maximo: number
  orden: number
  mostrar_en_rapido: boolean
  // Formato 'texto_natural' del ticket (ver lib/descripcionNatural.ts) —
  // ambos nullable, sin valor = grupo se pega directo sin conector / opción
  // única se muestra sin prefijo.
  conector: string | null
  prefijo_seleccion_unica: string | null
  // Cómo se ve el grupo en el sheet de personalización de producto (POS) —
  // 'cajas' = grid de 4 columnas que envuelve, 'lista' = filas de ancho
  // completo, 'chips' = píldoras compactas sin ícono de check. Control
  // explícito del admin, ya no se infiere por conteo de opciones (ver
  // SheetModificadores.tsx).
  estilo_visual: 'cajas' | 'lista' | 'chips'
}

export interface GrupoModificadorPadre {
  id: number
  grupo_id: number
  opcion_id: number
}

export interface OpcionModificador {
  id: number
  grupo_id: number
  nombre: string
  precio_extra: number
  orden: number
  activa: boolean
  // Disponibilidad automática por horario (F9-04), independiente del
  // horario del producto que la contiene — NULL en ambos = sin restricción.
  horario_desde: string | null
  horario_hasta: string | null
  // Imagen propia opcional — NULL cae en la foto/emoji del producto padre
  // (ver SheetCapturaPida.tsx / SheetModificadores.tsx, estilo 'cajas').
  foto_url: string | null
  // Categoría opcional para las chips de Modo captura rápida (ej.
  // "Clásicos", "Guisados") — NULL = solo aparece en "Todas" (ver
  // SheetCapturaPida.tsx). Independiente del grupo_id.
  etiqueta_captura_rapida: string | null
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
  cerrado_por: string | null
  notas: string | null
  // Patrón fijo (turnos_horario) emparejado automáticamente al abrir — NULL
  // si no hubo coincidencia clara (ver abrirTurno()).
  turno_horario_id: number | null
}

// Catálogo de patrones de turno fijos (/mas/permisos) — para el recordatorio
// proactivo de fin de turno programado, no para validar el cierre.
export interface TurnoHorario {
  id: number
  nombre: string
  hora_inicio: string // TIME 'HH:MM:SS'
  hora_fin: string
  activo: boolean
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
  // Marca cuándo se imprimió la precuenta (escenario 'precuenta' de
  // imprimirTicket) — se limpia (NULL) en cuanto ocurre cualquier cobro
  // real sobre el pedido, parcial o total (ver cobrarPedido()).
  precuenta_impresa_en: string | null
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
  // Combos electivos (F7-04): una entrada por slot con selección, ej.
  // [{"slot_id": 3, "producto_id": 45}]. null si el producto no tiene
  // slots elegidos (incluye combos fijos y productos normales).
  combo_selecciones: { slot_id: number; producto_id: number }[] | null
  // Cuándo se envió a cocina (enviar_pedido_a_cocina()) — null si nunca se
  // envió (ej. ítem simple comunicado de viva voz, reconciliado al cobrar
  // vía enviar_pendientes_de_subpedidos(), que NO llena esta columna).
  enviado_en: string | null
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
  monto: number            // ingreso del negocio (sin propina)
  propina: number          // propina del cobro (va a meseros, no a caja)
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

export interface PedidoMesa {
  id: number
  pedido_id: number
  mesa_id: number
  created_at: string
  orden: number
  pos_x_original: number | null
  pos_y_original: number | null
  rotacion_original: number | null
}

export interface Ingrediente {
  id: number
  nombre: string
  disponible: boolean
  creado_en: string
}
