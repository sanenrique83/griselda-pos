# Griselda POS — Estado Consolidado del Proyecto (v3)
**Última actualización:** 31 de julio de 2026. Reemplaza la v2 — se cerraron 6 de 7 Hallazgos de Uso Real, se descartó H-07, y se construyó un feature grande no planeado originalmente (mesas unidas en cadena con geometría real, arrastre con imantado, marcadores de silla y semáforo de color).

**Leyenda:** ✅ Hecho y confirmado · 🟡 Parcial · ⚪ Spec listo, sin implementar · 🚫 Descartado/superado · ❓ No verificado

---

## Fase 2/3/4 (spec de marzo) — sin cambios desde la v1

Ver v1 para el detalle completo. Resumen: F2-01 hecho; F2-02, F2-04, F2-05, F2-08, F2-09 pasaron a Fase 7 (todos ✅ ahora, ver abajo); F2-03 pasó a F7-03 (✅); F2-06 descartado (superado por Fase 6); F2-07 (combos) pasó a F7-04 (⚪ pendiente, ver Fase 9); F2-10 parcialmente cubierto por Fase 5/7; F2-11 (backup automático) **sigue pendiente, sigue siendo la recomendación más urgente de todo este documento**; F3-01 (CFDI) pendiente de decisión fiscal; F3-03/04/05 en pausa por decisión de negocio; F4-01 (PIN mesero) pospuesto a propósito; F4-02 → F7-08 (✅); F4-03 (cambiar mesero de mesa activa) **sigue sin asignar a ninguna fase**.

## Fase 5 — Analítica

Sin cambios desde v1: F5-01 a F5-09 todos ✅ confirmados (incluyendo los 4 que se verificaron en esa sesión: F5-03, F5-05, F5-07, F5-09). F5-00 (nombres de perfiles) sigue ❓ sin verificar.

## Fase 6 — Costos, Inventario, Recetario, Reventa

| Fase | Estado |
|---|---|
| A-C (esquema, CRUD, compras) | ✅ Sin cambios, confirmado funcionando |
| D (Recetario + margen) | ✅ — **pero el mecanismo cambió por completo**, ver "Rediseño de recetas de dos niveles" abajo |
| E (descuento automático) | ✅ Conectado y confirmado con prueba real |
| F (producción por lotes) | ✅ **Ya no es parcial** — se completó la pantalla de captura al generalizar producción en el rediseño de dos niveles (Paso B) |
| G (reventa/mostrador) | ✅ Confirmado, bug de migraciones sin aplicar ya resuelto |

## Fase 7 — Operación Avanzada — **COMPLETA**

| Código | Estado |
|---|---|
| F7-01 Reimpresión de ticket desde Historial | ✅ |
| F7-02 Reapertura de mesa cerrada | ✅ Incluye reversión de estado de mesa y validación de conflicto (fix posterior al primer commit) |
| F7-03 Propina efectivo/tarjeta | ✅ |
| F7-04 Combos electivos | ⚪ **Deliberadamente pospuesta** — movida a Fase 9 con diseño actualizado al motor de recetas nuevo |
| F7-05 Corte Z diario | ✅ |
| F7-06 Reporte de cancelaciones | ✅ |
| F7-07 Mapa de mesas drag-and-drop | ✅ Incluye forma/tamaño/rotación reales |
| F7-08 Cierre de sesión por inactividad | ✅ Incluye campo de configuración en `/mas/permisos` |
| F7-09 Unir mesas persistente *(no numerada originalmente, salió de una idea durante el mapa de mesas)* | ✅ Confirmado con prueba de conflicto real |

## Fase 8 — Analítica Avanzada Pendiente

Sin cambios desde que se especificó — F8-01, F8-02, F8-03 siguen ⚪ sin implementar.

---

## Rediseño de recetas de dos niveles — el cambio más grande de esta ronda

Lo que originalmente era una corrección simple (`receta_insumos.opcion_id`) se convirtió en un **rediseño completo** al usarlo en la práctica con Tacos — se reemplazó por completo. Estado final:

| Pieza | Estado |
|---|---|
| Corrección 1 original (`opcion_id` en `receta_insumos`) | 🚫 **Aplicada y luego revertida** — reemplazada por el diseño de dos niveles. No queda rastro de `opcion_id` en el esquema actual. |
| Corrección 2 (`receta_variantes`, instrucciones por variante) | 🚫 **Nunca se implementó** — quedó en pausa cuando se decidió ir directo al rediseño de dos niveles en su lugar. Parte de su alcance (pantalla dedicada de Recetas en Inventario) se resolvió de forma distinta, ver abajo. |
| **Paso A** — unificar `ingredientes` en `insumos` | ✅ Confirmado. `opciones_modificador.insumo_id` reemplaza a `ingrediente_id` (columna vieja no eliminada, solo sin uso). |
| **Paso B** — `insumo_receta` (receta de insumo derivado) + generalizar `producciones` | ✅ Confirmado con prueba real (insumo derivado de prueba, producción por tandas, stock actualizado en ambos lados). |
| **Paso C** — simplificar `receta_insumos` (quitar `opcion_id`) | ✅ Aplicada. |
| **Paso D** — reescribir `aplicar_consumo_receta()` por cuarta vez, ahora vía `insumo_id` | ✅ Confirmado con prueba real de Tacos (insumo correcto según opción elegida, reversión correcta al cancelar). |
| Pestaña "Recetas" en Inventario | ✅ Existe — pero como **atajo al editor de Catálogo**, no como la "pantalla independiente con modo de preparación primero" que se llegó a diseñar en la Corrección 2. Si en algún momento quieres esa versión más desacoplada, sigue siendo válida como mejora futura, no se descartó por mala idea, solo no se llegó a construir. |
| Fix de FK ambigua en combos (`PGRST201`) | ✅ Aplicado en `cargarComboComponentes()` y `recetario/[productoId]/page.tsx`, con error ya visible en vez de descartado silenciosamente. |

**Nota importante para cuando retomes F7-04 (combos electivos):** el spec de Fase 9 ya está actualizado para usar este motor nuevo — no uses ningún diseño de combos que hayas visto mencionado antes de esta sección, quedó obsoleto.

---

## Benchmarking — comparativos contra visión original y competidores

Se hicieron 3 rondas de comparación, todas documentadas por separado:
1. **Manual Maestro (visión original, pre-Flutter)** vs. estado real — confirmó que el pivote de Flutter a web fue acertado, identificó KDS-sin-impresora como la decisión de diseño más distinta a lo planeado (válida, no error), y varios huecos reales (temporizador de mesa, mover mesa sin unir, alertas de variación, offline).
2. **6 competidores (Loyverse, Waiterio, Poster, Square, TouchBistro, Lightspeed, Toast)** vs. estado real — confirmó que Griselda POS ya iguala o supera a estas apps comerciales en varios rubros (receta por modificador específico, propina separada, costeo de dos niveles). Aportó ideas nuevas: mermas, reloj de asistencia, comisiones, pago QR, recibos digitales, impuestos desglosados.
3. **Empleados y Nómina (módulo que faltaba revisar)** — corrigió una tabla desactualizada del documento original, confirmó que reloj de entrada/salida sigue sin existir, y validó la idea de "exportación de horas+ventas+propinas" en vez de nómina integrada completa.

Todos los huecos identificados en estas 3 rondas ya están consolidados en el **spec de Fase 9** (ver abajo) — no hace falta volver a revisar estos documentos de benchmarking, ya se procesaron.

---

## Fase 9 — Combos Electivos + Hallazgos de Benchmarking (spec listo, nada implementado)

| Código | Descripción | Estado |
|---|---|---|
| F7-04 | Combos electivos (actualizado al motor nuevo) | ⚪ |
| F9-01 | Mover pedido a otra mesa sin unir | ⚪ |
| F9-02 | Dividir/deshacer una unión de mesas | ⚪ |
| F9-03 | Temporizador de mesa en vivo | ⚪ |
| F9-04 | Alertas automáticas de variación de ventas | ⚪ |
| F9-05 | Reporte por categoría y por zona | ⚪ |
| F9-06 | Disponibilidad de menú automática por horario | ⚪ |
| F9-07 | Mermas como concepto propio | ⚪ |
| F9-08 | Reloj de entrada/salida + exportación de horas | ⚪ |

## Hallazgos de Uso Real (H-01 a H-07) — **6 de 7 cerrados, H-07 descartada**

| Código | Descripción | Estado |
|---|---|---|
| H-01 | Anular pedido completo (con permiso configurable) | ✅ Reutilizó un permiso (`cancelar_pedido_mesero`) que ya existía sin conectar — sin migración nueva |
| H-02 | Orden asc/desc/personalizado de productos y modificadores | ✅ Incluyó el hallazgo de que `productos.orden` ya existía en la base real pero nunca en una migración versionada — corregido |
| H-03 | Pestañas de tipo de insumo en Inventario | ✅ |
| H-04 | Botón "Regresar" faltante en pantallas de `/mas/*` | ✅ 11 pantallas corregidas con componente compartido |
| H-05 | Posición real de comensales (silla) en el mapa de mesas | ✅ — pasó por dos rondas de corrección (ver detalle abajo) |
| H-06 | Acceso rápido "Nuevo comensal" desde el menú | ✅ — se corrigió de ubicación (footer de `VistaMenu.tsx`, no los tabs de `PosShell.tsx`) |
| H-07 | Preguntar cuántas personas al abrir la mesa | 🚫 **Descartada** — se reemplazó por asignación automática de silla en secuencia al agregar comensales, que cubre el mismo objetivo sin restarle agilidad al mesero |

### Cómo quedó el flujo final de H-05/H-06 (tras las correcciones)

- **Al abrir una mesa vacía:** aparece el diagrama de sillas (`ElegirSillaInicialShell.tsx`) **antes** de crear el pedido — el mesero elige la silla del comensal 1 (única decisión manual de todo el flujo), y `abrirPedidoMesa(mesaId, turnoId, sillaElegida)` crea pedido + comensal 1 en un solo paso.
- **Al tocar "+ Nuevo comensal"** (footer verde de `VistaMenu.tsx`, junto al botón azul "Ver comanda" que ya existía): asigna la siguiente silla libre en secuencia automáticamente, sin picker ni confirmación — cero fricción.
- El botón manual "🪑 Sillas" se mantiene para corregir manualmente si alguien se sentó distinto al orden automático.
- Pestaña de comensal muestra un badge compacto de silla (ej. "🪑4") en vez de "Comensal 2 — Silla 4", que era demasiado largo para una pestaña angosta.
- **Deuda de código conocida, no resuelta a propósito:** quedó una función `abrirPedidoMesa()` huérfana (sin llamadores) en `mesas/actions.ts`, y las ramas de "modo draft" en `PosShell.tsx` (`isDraft` y sus condicionales) también quedaron sin ningún camino que las alcance. Documentado en el propio código; pendiente de una limpieza aparte cuando se quiera.

---

## Mesas Unidas en Cadena + Semáforo de Color (feature nuevo, no estaba en ningún spec original)

Salió de una conversación sobre cómo se ven físicamente las mesas pegadas en la vida real — se construyó en una sola sesión grande, con 4 partes:

| Parte | Descripción | Estado |
|---|---|---|
| 1 | Geometría de sillas en cadena (`calcularPosicionesSillasCadena`) — 2 cabeceras fijas + resto repartido parejo entre costados, rectángulo de lados rectos, límite de 5 mesas por cadena | ✅ Verificado a mano (2 mesas → 3 por lado, 3 mesas → 5 por lado) |
| 2 | Arrastre con imantado en `/mas/mapa-mesas` — acercar una mesa a otra activa el mismo `unirMesas()` que ya existía, sin duplicar lógica | ✅ |
| 3 | Marcadores de silla siempre visibles sobre la forma de la mesa (llenos/vacíos), reutilizando la misma geometría | ✅ |
| 4 | Semáforo de color de la mesa completa (verde/naranja/azul/rojo), configurable y apagable desde `/mas/permisos` | ✅ Lógica centralizada en `lib/colorMesa.ts`, un solo lugar para que ninguna pantalla se desincronice |

**Detalle importante del semáforo:** el rojo se definió como "cero productos en la comanda + tiempo transcurrido", **no** "nada enviado a cocina" — se descartó esa versión a propósito porque generaría falsas alarmas con pedidos simples que se comunican de viva voz sin pasar por el botón "Enviar".

**Nota de alcance:** el mapa visual **sí se ve afectado** por esta feature (a diferencia de la decisión original de F7-09, donde el mapa se quedaba intacto al unir mesas) — esto fue una decisión consciente y confirmada durante el diseño, no una inconsistencia.

---

## Otro cambio suelto — editar grupo de modificadores existente

Hecho en una sesión aparte de Claude Code (no pasó por el flujo de specs de este documento) — revisado y aprobado después: conecta `actualizarGrupoModificador()` (que ya existía sin usarse, mismo patrón que otros hallazgos de esta ronda) a una UI real de edición en `SeccionProductos.tsx` — ahora se puede editar nombre/requerido/mínimo/máximo/condición de un grupo ya creado, no solo crear uno nuevo. Sin migración.

---

## Recomendaciones abiertas — actualizado

| Tema | Estado |
|---|---|
| Contraseña del admin | ❓ Sigue sin confirmar si se cambió — señalada desde el primerísimo análisis |
| RLS de tablas de caja legible por cualquier autenticado | ❓ Sigue sin confirmar si se cerró |
| **Backup automático de Supabase** | ⚪ **El pendiente más urgente de todo el documento**, sin cambios desde la v1 — cada semana que pasa hay más inventario/recetas/costeo en juego |
| Proceso de migraciones sin registro | 🟡 **Parcialmente resuelto** — se confirmó que el proyecto ya está vinculado al Supabase CLI (`supabase db push` funcionó correctamente y detectó qué migraciones ya estaban aplicadas), aunque el flujo del día a día sigue siendo mixto (a veces SQL Editor a mano). Vale la pena estandarizar en usar siempre el CLI de aquí en adelante. |
| Ambiente de staging separado de producción | ⚪ Sigue sin existir — cada feature grande (rediseño de recetas, Fase 7 completa) se probó directo contra producción |
| Reconciliación física de inventario | ⚪ Mencionado, sin spec |
| Conciliación de terminal bancaria | ⚪ Mencionado, sin spec |
| **Auditoría de queries contra el esquema real** | ⚪ **Nuevo** — el bug de `productos.orden` (encontrado de casualidad en H-02) sugiere que puede haber más casos similares acumulados de tantas sesiones de Claude Code en paralelo. Vale la pena una revisión sistemática en algún momento. |
| **Modelo de permisos escalará mal** | ⚪ Cada permiso nuevo es una columna booleana más en `config_sistema` (`descuentos_mesero`, `cancelaciones_mesero`, `cancelar_pedido_mesero` — este último reutilizado para H-01 en vez de duplicado). Funciona con 3-4; conviene una tabla de permisos antes de que sean 10. |
| **Código muerto pendiente de limpieza** | ⚪ **Nuevo** — `abrirPedidoMesa()` huérfana en `mesas/actions.ts` (sin llamadores) y las ramas de "modo draft" en `PosShell.tsx` (`isDraft` y condicionales relacionados), ambos dejados de lado tras el rediseño de H-05/H-06. Documentado en el código, no bloqueante, pero vale la pena una sesión de limpieza en algún momento. |

---

## Próxima vez que actualices este documento

Cuando implementes cualquier cosa de Fase 9 o de los Hallazgos de Uso Real, regresa aquí y mueve el renglón de ⚪ a ✅. Este documento solo es útil si se mantiene al día — ya se dejó pasar una vez, no conviene que se repita.
