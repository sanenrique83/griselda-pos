# Griselda POS — Estado Consolidado del Proyecto (v6)
**Última actualización:** 2 de agosto de 2026. Reemplaza la v5 — se cerró la "Cola Maestra v2" completa desde H-01 hasta el #10 (10 de 12 ítems), incluyendo el rediseño de Comanda en cascada (el más grande de uso diario de esta ronda), PIN rápido, administración de usuarios, y un segundo bug real de embed ambiguo (mismo patrón que `combo_productos`, esta vez en `grupos_modificadores`).

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

## Fase 9 — Combos Electivos + Hallazgos de Benchmarking — **COMPLETA**

| Código | Descripción | Estado |
|---|---|---|
| F7-04 | Combos electivos (`combo_slots`/`combo_slot_opciones`, consumo vía recursión existente, desglose en ticket) + UI de administración en `SeccionReceta.tsx` | ✅ |
| F9-01 | Mover pedido a otra mesa sin unir (`moverPedidoDeMesa`) | ✅ |
| F9-02 | Separar una mesa de una cadena unida (`separarMesaUnida`) — cierra el hueco de `orden`, restaura posición si no es temporal | ✅ |
| F9-03 | Temporizador de mesa en vivo (`TiempoMesa.tsx`), umbral configurable en `/mas/permisos` | ✅ |
| F9-04 | Alerta de ventas bajas en tiempo real (`dashboard_alerta_ventas_bajas()`, compara contra el mismo día de la semana a la misma hora) — visible en Dashboard y en `/mesas` solo para admin | ✅ |
| F9-05 | Reporte por categoría y por zona de preparación en el Dashboard | ✅ |
| F9-06 | Disponibilidad automática por horario — a nivel producto **y** a nivel opción de modificador individual, independiente de `turnos` | ✅ |
| F9-07 | Mermas como concepto propio (`mermas`, `registrar_merma()`, reutiliza el valor `'merma'` del enum que ya existía sin usar) | ✅ |
| F9-08 | Reloj de entrada/salida + exportación CSV de horas/ventas/propina por mesero (sin nómina integrada) | ✅ |

---

## `CLAUDE.md` — instrucciones persistentes para Claude Code

Se creó en la raíz del repo (no existía antes) — se carga automáticamente en cada sesión de Claude Code, a diferencia de este documento (`ESTADO_PROYECTO.md`), que **no** se lee ni actualiza solo sin que se le pida explícitamente. Cubre: recordatorio de actualizar este documento al terminar una tarea, el flujo de despliegue manual del print server (nunca se actualiza solo en la Pi), el hábito de verificar contra la base real antes de reportar algo como "no existe", dónde viven las cosas (`/mas/permisos` vs `/mas/configuracion`), los patrones ya establecidos que hay que reutilizar en vez de duplicar, y el modelo de recetas actual (para que ninguna sesión futura confunda el diseño de dos niveles con versiones anteriores descartadas).

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
| 2 | Arrastre con imantado — acercar una mesa a otra activa el mismo `unirMesas()` que ya existía, sin duplicar lógica | ✅ |
| 3 | Marcadores de silla siempre visibles sobre la forma de la mesa (llenos/vacíos), reutilizando la misma geometría | ✅ |
| 4 | Semáforo de color de la mesa completa (verde/naranja/azul/rojo), configurable y apagable desde `/mas/permisos` | ✅ Lógica centralizada en `lib/colorMesa.ts`, un solo lugar para que ninguna pantalla se desincronice |

**Detalle importante del semáforo:** el rojo se definió como "cero productos en la comanda + tiempo transcurrido", **no** "nada enviado a cocina" — se descartó esa versión a propósito porque generaría falsas alarmas con pedidos simples que se comunican de viva voz sin pasar por el botón "Enviar".

### Rondas de corrección posteriores (tras probarlo en el celular)

El diseño original se amplió y corrigió varias veces al usarlo de verdad — todo cerrado:

- **Consolidación del mecanismo de unión** — inicialmente se pensó en un modo de "selección múltiple + botón" para abrir varias mesas libres unidas desde el inicio; se descartó a favor de un solo mecanismo de arrastre que cubre los 3 casos (libre+libre, libre+ocupada, ocupada+ocupada) con la misma lógica de fondo.
- **Reacomodo visual persistente** — al unirse, las mesas normales (no temporales) se reposicionan visualmente pegadas a la principal, guardando su posición original en `pedido_mesas.pos_x_original/pos_y_original/rotacion_original`; al cobrar o separar, regresan solas a su lugar.
- **Mesas extra/temporales** — botón "+ Mesa extra" en `/mesas` reutiliza `mesas.temporal` (el mismo mecanismo de "Compartir mesa"); al cobrar, se borran por completo en vez de regresar a algún lado (`liberarMesasSatelite()` ya las manejaba, no se tocó).
- **Forma de los marcadores** — cambiaron de triángulo a medio círculo (respaldo hacia el centro de la mesa, asiento hacia afuera), con ángulo calculado a partir de la misma geometría de posiciones.
- **Arrastre extendido a `/mesas`** — inicialmente el arrastre-con-imán solo vivía en `/mas/mapa-mesas` (el editor de Admin); se portó también a la pantalla operativa `/mesas`, con una diferencia clave: en `/mesas` nunca se persiste una reposición libre (si sueltas sin imán, regresa sola — el reacomodo de layout permanente sigue siendo exclusivo del editor de Admin).
- **Tamaño de sillas** — subieron de 8px → 16px → **36px** (para igualar exactamente el tamaño de los círculos del picker de sillas), con `PAD_SILLA_PX` ajustado en cada paso.
- **Auto-acomodo sin colisión** — bug real encontrado en producción: una mesa nueva ("Extra 1") caía encima de una mesa real ya posicionada, porque el auto-acomodo siempre arrancaba en un origen fijo (30,30). Corregido con `calcularYInicioAutoGrid()`: calcula el borde inferior real de las mesas ya posicionadas **de esa misma área** y arranca la cuadrícula justo después — verificado numéricamente que ya no se superponen.
- **Pestañas de área** — el editor de Admin (`/mas/mapa-mesas`) y la pantalla operativa (`/mesas`) ahora navegan por área (tabla `areas` ya existente, reutilizando `crearArea()` de Catálogo sin duplicar lógica) — necesario porque el auto-acomodo y el arrastre deben respetar que cada área es su propio espacio de coordenadas.
- **"+ Mesa extra" hereda el área actual** — antes siempre caía en "Sin área" sin importar qué área estuvieras viendo; ahora usa el área seleccionada en ese momento (o la última seleccionada en Mapa, si se crea desde la vista Lista).
- **Cuadrícula de fondo más fina** — de 40px a 20px, para posicionar con más precisión en el editor de Admin.

**Nota de alcance que sigue vigente:** el mapa visual **sí se ve afectado** por esta feature (a diferencia de la decisión original de F7-09, donde el mapa se quedaba intacto al unir mesas) — decisión consciente y confirmada durante el diseño, no una inconsistencia.

---

## Auditoría de Código — 2 rondas completas

Se le pidió a Claude Code una auditoría completa (diagnóstico primero, sin tocar nada hasta revisar juntos) — usó la Management API de Supabase directo contra la base de producción, no solo el repo, lo que permitió encontrar cosas que un análisis de archivos no vería.

### Ronda 1 — severidad alta

| Hallazgo | Resolución |
|---|---|
| `ingredientes` sin RLS (hueco de seguridad real — tabla muerta funcionalmente pero con datos reales, abierta a la anon key) | ✅ Se confirmó que las 60 filas ya tenían equivalente en `insumos` (cero huérfanas) y que las 182 referencias de `opciones_modificador.ingrediente_id` ya apuntaban también a `insumo_id` — se hizo el DROP completo de la tabla en vez de solo taparla con RLS |
| `categorias.modo_captura` — columna real sin ninguna migración | ✅ Migración escrita documentando el tipo real (texto plano, no el enum que usa `productos.modo_captura` — esa inconsistencia de tipos queda anotada, sin resolver todavía) |
| `config_sistema` — 8 columnas `ticket_*` sin ninguna migración ni en `database.types.ts` | ✅ Migración + tipos actualizados |

### Ronda 2 — severidad media/baja

| Hallazgo | Resolución |
|---|---|
| 6 escrituras "fire-and-forget" de mayor impacto (limpieza de mesas al cobrar, inserts de comensal 1, ajuste de caja al cancelar) sin manejo de error | ✅ Se agregó log + propagación selectiva: si la operación de negocio ya se completó, solo se loguea (no confundir al usuario mostrando "falló" sobre algo que ya pasó); si nada se ha comprometido todavía (ej. insertar el comensal 1), sí se propaga el error |
| `toggleDisponible` duplicada con comportamiento distinto entre Catálogo y Menú del día | ✅ Consolidada en una sola función |
| `movimientos_inventario` sin política de escritura directa (intencional, todo pasa por RPCs) | ✅ Documentado con `COMMENT ON TABLE/POLICY`, para que nadie intente "arreglarlo" agregando una política directa que abra un camino paralelo a los RPCs |
| Código muerto: `abrirPedidoMesa()` huérfana, `crearPedidoYAgregarProducto`/`crearPedidoYAgregarRapido`, ramas de "modo draft" en `PosShell.tsx` | ✅ Todo eliminado — confirmado que el único punto de entrada real (`pos/[pedidoId]/page.tsx`) siempre resuelve `pedidoId` a un número válido antes de llegar a `PosShell`, así que `pedidoId: number \| null` pasó a ser `pedidoId: number` |

**Los 93 casos de solo-lectura sin manejo de error** (menor severidad) se dejaron sin tocar a propósito — se decidió adoptarlo como práctica hacia adelante, no como limpieza retroactiva masiva.

---

## Otro cambio suelto — editar grupo de modificadores existente

Hecho en una sesión aparte de Claude Code (no pasó por el flujo de specs de este documento) — revisado y aprobado después: conecta `actualizarGrupoModificador()` (que ya existía sin usarse, mismo patrón que otros hallazgos de esta ronda) a una UI real de edición en `SeccionProductos.tsx` — ahora se puede editar nombre/requerido/mínimo/máximo/condición de un grupo ya creado, no solo crear uno nuevo. Sin migración.

---

## Recomendaciones Abiertas — Repaso Completo de Pendientes de Todas las Fases

Con Fase 9 cerrada, se hizo un repaso deliberado de qué quedó pendiente de fases anteriores que nunca se cerró — organizado por urgencia real, no por antigüedad.

### Lo más urgente — repetido varias veces en esta conversación, nunca resuelto

| Tema | Estado |
|---|---|
| **Backup automático de Supabase (F2-11)** | ⚪ **El pendiente más urgente de todo el documento**, sin cambios desde la v1 — cada semana que pasa hay más inventario/recetas/costeo en juego. |
| **Operación sin internet / resiliencia offline** | ⚪ El sistema depende 100% de conexión. Señalado desde el análisis original de todo el proyecto; nunca se ha atacado con ningún spec. |
| **RLS de tablas de caja legible por cualquier autenticado** | ❓ Señalado desde el primerísimo análisis. La auditoría de código cerró el caso de `ingredientes`, pero **no se confirmó explícitamente si este otro caso (tablas de caja/`movimientos_caja` y similares) sigue abierto o ya se resolvió de paso** — vale la pena una verificación puntual antes de asumir cualquier cosa. |
| **Contraseña del admin** | ❓ Nunca se confirmó si de verdad se cambió del default original. |

### Huecos genuinos sin fase asignada

| Tema | Estado |
|---|---|
| **F4-03 — Cambiar el mesero asignado a una mesa activa** | ⚪ Identificado desde el spec original de marzo, nunca asignado a ninguna fase posterior. Sigue sin construirse. |
| **Fase 8 completa** (F8-01 heatmap de horas pico, F8-02 scatter margen vs. volumen, F8-03 predicción de demanda) | ⚪ Especificada hace tiempo, nunca implementada — el proyecto se desvió hacia el rediseño de recetas y luego Fase 9. **Dato a favor:** F9-04 (alerta de ventas bajas) ya construyó el mismo patrón de comparación "mismo día de la semana a la misma hora" que necesita F8-03 — implementarla ahora sería más barato que antes de que existiera ese precedente. |
| **F5-00 — Verificar nombres de perfiles** | ✅ Auditado y corregido: los ~15 sitios que resuelven `usuario_id`/`mesero_id` → nombre ahora usan `primerNombreValido()` (`lib/nombreUsuario.ts`), fallback único `'Sin registrar'` que también captura string vacío (no solo `null`/`undefined`). Historial ahora también muestra el nombre del mesero. |

### Deuda técnica que sigue creciendo

| Tema | Estado |
|---|---|
| **Modelo de permisos escalará mal** | ⚪ Cada feature nueva agrega otra columna booleana a `config_sistema` — ya son varias (`descuentos_mesero`, `cancelaciones_mesero`, `cancelar_pedido_mesero`, `alerta_mesa_sin_atender`/`_minutos`, `tiempo_mesa_alerta_minutos`, `modificadores_por_linea`, `alerta_ventas_bajas_activa`/`_umbral_pct`, `orden_productos`/`orden_modificadores`/`orden_popularidad_dias`, `formato_modificadores_ticket`, `alerta_precuenta_activa`/`_minutos`, `turno_diferencia_alerta_monto`...). Cada vez más urgente considerar una tabla de permisos en vez de seguir agregando columnas — el argumento de "esperar a que sean 10" ya se cumplió varias veces de sobra. |
| **`grupos_modificadores.padre_opcion_id` sin terminar de eliminar** | ⚪ **Ya causó un bug real en producción dos veces** con el mismo patrón que `ingredientes` (FK viva desde una columna deprecada, ambigüedad de embed en PostgREST) — primero con `combo_productos`, ahora con `opciones_modificador`↔`grupos_modificadores`. Ambas veces se corrigió con un hint de FK explícito, pero la causa de fondo (la columna deprecada nunca se terminó de eliminar) sigue viva y puede repetirse en cualquier embed futuro. Vale la pena terminar su `DROP`, igual que ya se hizo con `ingredientes` en la auditoría. |
| **Inconsistencia de tipos: `categorias.modo_captura` (texto plano) vs. `productos.modo_captura` (enum)** | ⚪ Detectado en la auditoría, documentado a propósito sin resolver (cambiar el tipo de una columna en producción es una decisión aparte, con más riesgo que solo documentarla). |
| **Ambiente de staging separado de producción** | ⚪ Sigue sin existir — todo lo grande de esta conversación (rediseño de recetas, Fase 7, mesas unidas visual, Fase 9 completa, Cola Maestra v2) se probó directo contra producción. |
| Proceso de migraciones | 🟡 Resuelto en la práctica — el proyecto está vinculado al Supabase CLI y se ha usado consistentemente (`supabase db push`) en toda la Fase 9 y la Cola Maestra v2. |
| Reconciliación física de inventario | ⚪ Mencionado hace tiempo, sin spec todavía. |
| Conciliación de terminal bancaria | ⚪ Mencionado hace tiempo, sin spec todavía. |

### Ya resuelto — sin acción pendiente

- ✅ Auditoría de queries contra el esquema real (2 rondas completas).
- ✅ Código muerto identificado en la auditoría (todo eliminado).

---

## Cola Maestra v2 — 10 de 12 completados (H-01 a #10)

Todos los ítems de abajo están ✅ **implementados, revisados a fondo, y con su migración ya aplicada** — no quedan pendientes de `supabase db push` de esta ronda.

| # | Tema | Detalle |
|---|---|---|
| 1 | **C3 — `mesas.fuera_de_servicio`** | Mesa marcada así no es seleccionable para abrir pedido nuevo pero tampoco cuenta como ocupada — color gris + 🔧 propio en el semáforo (`lib/colorMesa.ts`). |
| 2 | **Alerta de precuenta + reordenar checkbox de ticket** | `pedidos.precuenta_impresa_en` se marca al imprimir precuenta, se limpia en cualquier cobro real. Indicador aparte del semáforo (🧾 hace X min), umbral configurable en `/mas/permisos`. El checkbox "Imprimir ticket de pago" se movió al pie fijo, pegado a "Cobrar" — separado de "Imprimir cuenta" (etapa distinta). |
| 3 | **Navegación entre comensales en el menú** | Pasó por dos rondas de refinamiento tras usarlo en la práctica — ver detalle abajo, "Cómo quedó la navegación final". |
| 4 | **Orden de modificadores por popularidad** | Cuarta opción de `orden_modificadores` (`'popularidad'`) — cuenta selecciones de los últimos `orden_popularidad_dias` días vía RPC, solo en POS, nunca en Catálogo (donde el orden se queda estable para editar). |
| 5 | **F4-03 — Reasignar mesero de un pedido activo** | Solo `pedidos.mesero_id` (no `subpedidos.mesero_id`, que es trazabilidad histórica y se deja intacta a propósito). Admin-only, verificado server-side. |
| 6 | **Texto coherente de modificadores en el ticket** | Tercera opción de `formato_modificadores_ticket` (`'texto_natural'`) — frase gramatical vía `construirDescripcionNatural()`, con `conector`/`prefijo_seleccion_unica` configurables por grupo y vista previa en vivo en Catálogo. Aplica a cocina, cliente, y reimpresión desde Historial. |
| 7 | **Administración de usuarios (`/mas/usuarios`)** | Crear usuario vía `lib/supabase/admin.ts` (service_role, requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y Vercel — ya configurada). **Fix crítico de seguridad incluido:** `perfiles.activo=false` ahora sí bloquea acceso real (antes solo ocultaba de listas) — `(app)/layout.tsx` cierra sesión en cada navegación si detecta la cuenta desactivada. |
| 8 | **PIN rápido (`/cambiar-usuario`)** | El más delicado de toda la cola — cambio de sesión real (magic-link + `verifyOtp()`, no un "usuario activo" simulado), lectura de `pin_hash` nunca expuesta vía RLS normal (siempre por el cliente admin, server-side), lockout de 5 intentos en BD. Definir/resetear PIN vive dentro de `/mas/usuarios`. Pendiente explícito, no construido: que el timeout de inactividad (F7-08) regrese aquí en vez de cerrar sesión completa. |
| 9 | **Pestaña "Pedidos" mejorada** | Reemplaza lo que iban a ser dos cosas nuevas separadas (Tablero en vivo + historial temporal) — se descubrió que `/pedidos` ya existía mostrando solo conteos; se le agregó detalle real por comensal (nombre de cada producto) y `pedido_productos.enviado_en` con "hace X min" junto a cada línea ya enviada. |
| 10 | **Comanda en cascada** | El rediseño más grande de uso diario. Pestañas → secciones apiladas en scroll, cada una con su propio "+ Agregar" (navega a Menú con ese comensal activo, sin selección previa). Indicador de "🔁 N rondas" por comensal (cuenta valores distintos de `enviado_en` entre sus ítems enviados — no por categoría ni por gap de tiempo, ambos descartados por ser poco confiables). El sheet "Mover a otro comensal" se corrigió para usar el origen real del ítem tocado (`origenSubId`) en vez de un "comensal activo" global, que dejó de tener sentido en una cascada. |

### Cómo quedó la navegación final entre comensales (tras dos rondas de refinamiento)

El diseño original de este ítem ("Volver al comensal 1") resultó incompleto al usarlo en la práctica — no había forma de avanzar al comensal 2, 3, etc. sin ir a la pestaña de Comanda. Quedó así:

- **"Nuevo comensal"** (izquierda, sin el ícono "+" — redundante con la palabra) — siempre crea uno nuevo, nunca hace nada más.
- **"→ Siguiente (X de Y)"** (derecha) — recorre en orden (`comensal_numero`) únicamente los comensales que **ya existen**, dando la vuelta del último al primero automáticamente (módulo, sin caso especial). Nunca salta a sillas físicas vacías que no se hayan creado explícitamente con "Nuevo comensal" — si solo hay 2 comensales activados en una mesa de 4 sillas, el recorrido es 1→2→1→2...

Los dos botones nunca se pisan: uno crea, el otro solo recorre lo que ya existe.

## Bug crítico encontrado a media ronda — embed ambiguo, segunda vez

Durante las pruebas del #9, la Comanda de una mesa con pedido real dejó de mostrar comensales/productos (aunque sí existían en la base, confirmado vía `/pedidos`). Causa: **el mismo patrón de FK ambigua que ya resolvimos con `combo_productos`**, esta vez entre `opciones_modificador` y `grupos_modificadores` — el query embebido (agregado en el ítem 6, texto coherente) nunca especificó el hint de FK, y como `grupos_modificadores.padre_opcion_id` (columna **ya marcada `@deprecated` desde hace tiempo, nunca se completó su `DROP`**) sigue teniendo una FK viva hacia `opciones_modificador`, PostgREST no podía resolver el embed sin ambigüedad — y el error se descartaba en silencio porque la consulta no revisaba su propio `error`.

**Corregido:** los 3 sitios reales que hacían este embed (`pos/[pedidoId]/page.tsx`, `cobro/[pedidoId]/page.tsx`, `historial/actions.ts`) ahora usan el hint explícito `grupos_modificadores!opciones_modificador_grupo_id_fkey`, y la consulta de `pos/[pedidoId]/page.tsx` ya loguea su error si vuelve a fallar.

**Esto refuerza, por segunda vez, la recomendación de terminar el `DROP` de `padre_opcion_id`** — ver "Recomendaciones Abiertas" arriba, ya no es solo teórico, ya causó un bug real en producción dos veces con el mismo patrón.

## Lo que falta de la Cola Maestra v2

- **#11 — Bloque E (experiencia visual e interacción)** — sonido/vibración, favoritos curados, mensaje de despedida, splash screen, animación de rebote. Spec listo, sin implementar.
- **#12 — Bloque A (motor de recetas, rediseño de UX)** — el más grande, dejado a propósito al final: buscar-o-crear inline de insumos/utensilios, instrucciones por insumo derivado, rendimiento aprendido de producciones históricas. Spec listo (A1-A5), sin implementar.
- **Recordatorio proactivo de fin de turno** — spec ya escrito (`turnos_horario` como catálogo de patrones fijos, emparejado automático al abrir turno vía `dentroDeHorario()` ya existente, aviso configurable "faltan X min para tu turno programado"). **Se había perdido de vista, nunca quedó anotado en ninguna cola anterior** — recuperado y agregado aquí. Distinto de C1 (que es validación de diferencia de efectivo al cerrar) — este es puramente proactivo, antes de llegar a la hora de fin programada, no bloquea nada.

**Todavía sin spec, esperando alguna decisión tuya** (sin cambios desde la v5): C6 (botón SOS, falta que confirmes qué debe hacer), Bloque F (identidad visual — verde agave/monoespaciado, viste el mockup, falta tu confirmación), Fase 8 completa (F8-01/02/03), 3 hallazgos de las conversaciones ChatGPT (límite de descuentos, modo de prueba, alertas por WhatsApp/Telegram), y la conversación de multi-tenant/SaaS vendible — **guardada explícitamente para el final de todo**, como pediste.

---

## Próxima vez que actualices este documento

Cuando implementes cualquier cosa de la lista de "Todavía NO listos" (ver el documento de spec correspondiente — Bloque E, Bloque A, C6, etc.), regresa aquí y agrega su renglón. Este documento solo es útil si se mantiene al día — ya se dejó pasar una vez, no conviene que se repita.
