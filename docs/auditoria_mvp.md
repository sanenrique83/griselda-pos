# Auditoría MVP — Griselda POS v4
**Fecha:** 2026-02-25
**Referencia:** `griselda_pos_v4_final.docx` · `griselda_wireframe_v2.html`
**Fuente auditada:** `/frontend/src/` · `/supabase/migrations/` · `/backend/` (vacío)

---

## Leyenda
| Símbolo | Significado |
|---------|-------------|
| ✅ | Implementado y funcionando |
| ⚠️ | Implementado parcialmente o con comportamiento distinto al spec |
| ❌ | Definido en el documento pero no implementado |

---

## 1. Mesas

| Estado | Feature |
|--------|---------|
| ✅ | Grid de mesas agrupadas por área (libre / ocupada con colores) |
| ✅ | Tocar mesa libre → POS en modo draft (sin crear pedido en BD hasta confirmar primer ítem) |
| ✅ | Tocar mesa ocupada → navega directamente al pedido existente |
| ✅ | Botón "Para llevar" destacado con SheetParaLlevar (nombre, teléfono, hora recogida — todos opcionales) |
| ✅ | Aviso si no hay turno activo al intentar abrir mesa |
| ✅ | Contador mesas ocupadas / total en header |
| ⚠️ | Layout visual: grid fijo 2 columnas — el wireframe muestra un mapa con posiciones relativas; el mapa drag-and-drop está marcado como Fase 2 en el spec, pero la lista en cuadrícula no refleja el plano real del restaurante |
| ❌ | Reapertura de mesa cerrada por error (Solo Admin, desde historial, con registro en auditoría) |

---

## 2. POS / Menú

| Estado | Feature |
|--------|---------|
| ✅ | Tabs de categorías scrollables en la parte superior |
| ✅ | Lista de productos con emoji / imagen, precio en fuente mono verde |
| ✅ | Botón fijo al pie "Ver comanda" con total acumulado |
| ✅ | Modo estándar: `SheetModificadores` con grupos condicionales (`padre_opcion_id`) correctamente implementados |
| ✅ | Grupos requeridos bloquean "Confirmar" hasta completarse |
| ✅ | Modo captura rápida: `SheetCapturaPida` con contadores `[− n +]` por guisado; valor en azul si > 0 |
| ✅ | Draft mode: `pedidoId: null` en `PosShell`; el pedido se crea en BD solo al confirmar el primer ítem |
| ✅ | Imágenes de producto visibles en catálogo (Supabase Storage) |
| ⚠️ | **Combos** (`es_combo = TRUE`): campo existe en BD y en tipos, pero `SheetModificadores` no diferencia el flujo de combo — no hay selección de componentes, ni lógica de `incluye_extras`, ni vista de componentes al elegir el combo |
| ❌ | Pre-cuenta (imprimir sin registrar cobro, disponible en cualquier momento del pedido) |
| ❌ | Botón "Enviar sin imprimir" al enviar a cocina (nivel 2 de control de impresión) |
| ❌ | Menú del día: toggle masivo de disponibilidad (pantalla Solo Admin con "Todos disponibles") |

---

## 3. Comanda

| Estado | Feature |
|--------|---------|
| ✅ | Tabs por comensal con dot azul si hay pendientes |
| ✅ | Botón `+` para agregar comensal |
| ✅ | Botón `×` para eliminar comensal vacío |
| ✅ | Items con 3 estados visuales: Pendiente (azul/borde), Enviado (verde), Cancelado (tachado, opaco) |
| ✅ | Enviar a cocina: solo habilita si hay ítems pendientes; llama `enviarACocina()` |
| ✅ | Pie fijo: tres botones (+ Agregar · Enviar · Cobrar) con 44 px mínimo |
| ✅ | Header con número de mesa, hora de apertura y tiempo transcurrido |
| ✅ | Unir mesa: `SheetUnirMesa` que mueve subpedidos al pedido destino |
| ✅ | Compartir mesa: crea nuevo pedido paralelo en la misma mesa |
| ❌ | **Cancelación de ítem enviado**: no existe botón/flujo — motivo obligatorio, registro en tabla `cancelaciones`, movimiento_caja tipo `'cancelacion'` con monto negativo, ticket de aviso a cocina |
| ❌ | Pre-cuenta desde la comanda |

---

## 4. Cobro

| Estado | Feature |
|--------|---------|
| ✅ | 4 escenarios: Cuenta general · Individual · Uno paga varios · Dividir igual |
| ✅ | Escenario "Individual": radio — selección excluyente de un subpedido |
| ✅ | Escenario "Varios": checkbox — selección múltiple de subpedidos |
| ✅ | Escenario "Dividir": inputs N partes / M a pagar ahora, precio por parte en tiempo real |
| ✅ | 4 métodos: Efectivo · Tarjeta · Transferencia · Mixto |
| ✅ | Efectivo: input con quick chips de billetes MXN (100/200/500/1000/2000 + Exacto) |
| ✅ | Cálculo de vuelto / faltante en tiempo real con color verde/rojo |
| ✅ | Pago mixto: distribución por campo (E/T/X); cambio calculado solo sobre la parte de efectivo |
| ✅ | Propina sugerida: toggle configurable, añade monto al total sin cobrarse automáticamente |
| ✅ | Datos bancarios CLABE / banco / titular mostrados al elegir transferencia o mixto con monto en X |
| ✅ | Botón "Anular mesa" visible únicamente cuando `totalPedido === 0` |
| ✅ | Registro de `pagos` (tabla detalle) para pago mixto |
| ⚠️ | Pre-cuenta "🖨 Imprimir cuenta": usa `window.print()` — no es ticket ESC/POS real, sin integración al servidor de impresión |
| ⚠️ | Escenario "Dividir" con partes parciales: calcula el monto correcto, pero `cobrarPedido` cierra el pedido completo aunque queden partes sin pagar — el soporte de cobro parcial (mantener subpedidos `activo`) no está completamente validado para múltiples visitas |
| ❌ | Descuentos / cortería desde pantalla de cobro |
| ❌ | Impresión real de ticket de cliente (4 formatos automáticos según escenario) |

---

## 5. Turno

| Estado | Feature |
|--------|---------|
| ✅ | Formulario "Abrir turno" con fondo inicial → `movimiento_caja` tipo `'fondo'` |
| ✅ | Quick chips de fondo ($0, $200, $300, $500) |
| ✅ | Resumen ventas del turno por método (efectivo / tarjeta / transferencia) |
| ✅ | Efectivo teórico calculado: fondo + cobros en efectivo + fondos extra − retiros |
| ✅ | Input "Efectivo contado en caja" con diferencia en tiempo real (✓ cuadra / sobrante / faltante) |
| ✅ | Campo de notas del cierre (opcional) |
| ✅ | Pedidos abiertos bloquean el botón "Cerrar turno" con aviso |
| ⚠️ | El efectivo teórico **ya considera** fondos extra y retiros en la fórmula, pero **no existe UI** para crear esos movimientos durante el turno — los campos `fondosExtra` y `retirosTotal` quedan siempre en $0 hasta que se implemente la pantalla de tesorería |
| ❌ | **Gestión de tesorería mid-turno**: botones "Depositar" y "Retirar" (movimientos tipo `'fondo'` y `'retiro'` durante el turno) |

---

## 6. Dashboard

| Estado | Feature |
|--------|---------|
| ✅ | Solo Admin: redirige a `/mesas` si rol ≠ `admin` |
| ✅ | 4 métricas: Total cobrado · Pedidos cerrados · Promedio ticket · Mesas activas |
| ✅ | Desglose de métodos de pago con barras de progreso (CSS, porcentaje calculado correctamente) |
| ✅ | Top 6 productos más vendidos del turno (con monto total generado) |
| ✅ | Estado vacío si no hay turno o sin cobros |
| ⚠️ | Las barras de métodos de pago son CSS puro — el spec especifica **Recharts** con gráficas interactivas; `recharts` no está instalado en `package.json` |
| ❌ | Gráfica de ventas por hora (barras por franja horaria del turno) |
| ❌ | Gráfica top 10 productos (barras horizontales Recharts) |
| ❌ | Dona "Métodos de pago" (Recharts) |
| ❌ | Dona "Mesa vs para llevar" |
| ❌ | Métrica "Ticket promedio vs turno anterior" |
| ❌ | Métrica "Descuentos del turno" (monto total y número de aplicaciones) |
| ❌ | **12 reportes exportables a CSV** (ninguno implementado) |

---

## 7. Catálogo

| Estado | Feature |
|--------|---------|
| ✅ | CRUD Mesas: crear, editar (número, nombre, capacidad, área), toggle activa, eliminar |
| ✅ | CRUD Áreas (dentro de SeccionMesas): crear y asignar |
| ✅ | CRUD Categorías: nombre, grupo_impresora, orden, toggle activa |
| ✅ | CRUD Productos: nombre, precio, emoji, categoría, modo_captura, toggle disponible / activo |
| ✅ | Subida de imagen de producto (Supabase Storage, bucket `"productos"`) |
| ✅ | CRUD Grupos Modificadores por producto (nombre, requerido, mín/máx, orden, mostrar_en_rapido) |
| ✅ | CRUD Opciones de modificador (nombre, precio_extra, activa) |
| ✅ | Toggle disponible por producto (agotado del día) |
| ⚠️ | **Combos**: `es_combo` como checkbox en formulario de producto, pero sin sección/UI para gestionar `combo_productos` (componentes, cantidades, `incluye_extras`) |
| ⚠️ | `padre_opcion_id` para grupos condicionales no está expuesto en la UI del catálogo (solo se usa en runtime del POS) |
| ❌ | **Menú del día**: pantalla con toggle individual por producto + botón "Todos disponibles" (Solo Admin) |

---

## 8. Permisos

| Estado | Feature |
|--------|---------|
| ✅ | Toggle `cancelaciones_mesero` — mesero puede cancelar productos enviados |
| ✅ | Toggle `descuentos_mesero` — mesero puede aplicar descuentos |
| ✅ | Toggle `cancelar_pedido_mesero` — mesero puede anular mesa completa (extra vs spec, añadido en migración 20260224000001) |
| ✅ | Toggle `ver_dashboard_mesero` — acceso al dashboard (extra vs spec) |
| ✅ | Datos bancarios: banco, CLABE, titular (para mostrar en pantalla de cobro) |
| ✅ | `propina_sugerida_pct` — porcentaje configurable con input numérico |
| ⚠️ | `descuento_max_pct` — campo existe en BD y en tipo `ConfigPermisos`, pero no está visible en la UI de PermisosShell (no se renderiza input) |
| ⚠️ | `corteria_requiere_nota` — campo en BD pero sin UI en pantalla de permisos |
| ❌ | Aplicación efectiva de `descuentos_mesero` y `descuento_max_pct` en el flujo de cobro (la pantalla de cobro no tiene botón de descuento) |

---

## 9. Impresoras

| Estado | Feature |
|--------|---------|
| ✅ | CRUD impresoras: nombre, IP, puerto, ancho_papel (`58mm` / `80mm`), toggle activa |
| ✅ | 5 toggles exactos por impresora: recibos · pedidos · automático · un artículo por ticket · agrupar idénticos |
| ✅ | CRUD grupos impresora: nombre, impresora asignada (dropdown) |
| ✅ | Toggle global `impresion_activa` en config_sistema |
| ✅ | Asignación de categorías a grupos impresora (bottom sheet con checkboxes) |
| ❌ | **Servidor de impresión Raspberry Pi**: el directorio `/backend/` está vacío — no existe `server.js`, `router.js`, `printer.js`, ni `templates/` |
| ❌ | Integración real: `enviarACocina()` en actions.ts solo cambia `estado` de ítems en BD, **no envía nada a ningún endpoint ESC/POS** |
| ❌ | Ticket de cocina (formato: mesa, mesero, comensales, ítems agrupados por grupo_impresora) |
| ❌ | 4 formatos de ticket de cliente automáticos según escenario de cobro |
| ❌ | Cancelaciones impresas en cocina (ticket "[CANCELACION]" con motivo) |
| ❌ | Manejo de errores de conexión (Raspberry no responde → error en UI, reintento, productos permanecen `pendiente`) |

---

## 10. Historial

| Estado | Feature |
|--------|---------|
| ✅ | Lista de cobros del turno activo ordenada cronológicamente |
| ✅ | Muestra: etiqueta de mesa/llevar, ID, hora, método(s) de pago, total |
| ✅ | Indicador "Mixto" si hay más de un método de pago |
| ✅ | Bottom sheet de detalle: monto total, desglose por método, efectivo recibido y cambio entregado |
| ⚠️ | Botón "Reimprimir" presente en el sheet pero deshabilitado con texto `"próximamente"` — sin funcionalidad real |
| ❌ | **Solo muestra el turno activo** — no hay modo de consultar cobros de turnos anteriores / histórico completo |
| ❌ | Reimpresión real de ticket histórico con encabezado `[REIMPRESION]` enviado al servidor de impresión |

---

## Resumen ejecutivo por módulo

| Módulo | ✅ Impl. | ⚠️ Parcial | ❌ Faltante |
|--------|----------|-----------|------------|
| Mesas | 6 | 1 | 1 |
| POS / Menú | 8 | 1 | 3 |
| Comanda | 9 | 0 | 2 |
| Cobro | 9 | 2 | 2 |
| Turno | 6 | 1 | 1 |
| Dashboard | 5 | 1 | 6 |
| Catálogo | 8 | 2 | 1 |
| Permisos | 6 | 2 | 1 |
| Impresoras | 5 | 0 | 6 |
| Historial | 4 | 1 | 2 |
| **Total** | **66** | **11** | **25** |

---

## Hallazgos críticos (bloquean operación real)

1. **Servidor de impresión inexistente** — `enviarACocina()` no manda nada a ninguna impresora. Las comandas solo cambian estado en BD. El personal de cocina no recibe ningún aviso.

2. **Cancelación de ítems enviados no implementada** — el flujo más frecuente en operación real (cliente cancela un platillo ya enviado a cocina) no existe: no hay botón, no hay registro en `cancelaciones`, no hay ticket de aviso.

3. **Gestión de tesorería mid-turno ausente** — el cuadre de caja al cerrar turno calcula retiros y depósitos, pero no hay forma de crearlos desde la UI.

4. **Combos sin flujo de componentes** — productos marcados como `es_combo=TRUE` se comportan como productos normales; no se muestran componentes ni se permite modificar cada uno por separado.

5. **Dashboard sin gráficas Recharts** — el spec exige 6 gráficas interactivas como feature de Fase 1; solo hay métricas numéricas con barras CSS estáticas y no hay reportes CSV.
