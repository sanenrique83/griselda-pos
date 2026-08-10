# Griselda POS — Estado Consolidado del Proyecto (v6)
**Última actualización:** 2 de agosto de 2026. Reemplaza la v5 — se cerró la "Cola Maestra v2" completa desde H-01 hasta el #10 (10 de 12 ítems), incluyendo el rediseño de Comanda en cascada (el más grande de uso diario de esta ronda), PIN rápido, administración de usuarios, y un segundo bug real de embed ambiguo (mismo patrón que `combo_productos`, esta vez en `grupos_modificadores`).

**Verificación independiente de esta actualización (Rober + Claude, no solo el autoreporte de Claude Code):** se confirmó directamente en código, línea por línea, que el fix de seguridad de `perfiles.activo` (`(app)/layout.tsx`, cierra sesión server-side en cada navegación si la cuenta fue desactivada) y el fix del embed ambiguo de `grupos_modificadores` (hint de FK explícito en los 3 sitios reales) están correctamente implementados — no solo documentados. Se confirmó con Rober directamente que "Manual de usuario" y "Rediseño de roles + permisos" (más abajo) son decisiones reales suyas, contempladas desde hace tiempo pero no activadas — no algo que Claude Code haya asumido por su cuenta. Se confirmó que `SUPABASE_SERVICE_ROLE_KEY` ya está configurada en Vercel (necesaria para #7 y #8).

**Nota de proceso:** esta ronda reveló que `CLAUDE.md` sí está logrando su propósito — Claude Code actualizó este documento por su cuenta con el trabajo de varias sesiones (incluyendo el rediseño de Comanda en cascada, PIN rápido, administración de usuarios, y los dos bugs/fixes de esta nota) sin que se le pidiera explícitamente cada vez. Esto significa que hay que **verificar este documento contra el código real periódicamente**, igual que cualquier trabajo de Claude Code — no asumir que "ya está documentado" equivale a "ya fue revisado por un humano".

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
| 7 | **Administración de usuarios (`/mas/usuarios`)** | Crear usuario vía `lib/supabase/admin.ts` (service_role, requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y Vercel — **confirmado con Rober que ya está configurada en Vercel**). **Fix crítico de seguridad incluido:** `perfiles.activo=false` ahora sí bloquea acceso real (antes solo ocultaba de listas) — `(app)/layout.tsx` cierra sesión en cada navegación si detecta la cuenta desactivada. |
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
- **Recordatorio proactivo de fin de turno** — spec ya escrito (`turnos_horario` como catálogo de patrones fijos, emparejado automático al abrir turno vía `dentroDeHorario()` ya existente, aviso configurable "faltan X min para tu turno programado"). **Se había perdido de vista, nunca quedó anotado en ninguna cola anterior** — recuperado y agregado aquí. Distinto de C1 (que es validación de diferencia de efectivo al cerrar) — este es puramente proactivo, antes de llegar a la hora de fin programada, no bloquea nada. Confirmado: la administración de `turnos_horario` vive en `/mas/permisos`, no en `/mas/turno` (mismo criterio de siempre: operativo vs. configuración de una sola vez).
- **Manual de usuario dentro de la app** — **decisión de diseño tomada, construcción pospuesta a propósito hasta que Rober lo pida.** `/mas/ayuda`, contenido **editable por el admin desde la app** (no hardcodeado, para que no se desactualice como pasaría con un PDF — se descartó el formato de documento por esta misma razón), secciones con visibilidad `'todos'`/`'admin'`. Diseño: tabla `manual_secciones` (titulo, contenido, orden, visible_para). Falta confirmar si arranca con contenido mínimo de ejemplo (2-3 secciones) o más completo desde el inicio, antes de escribir el prompt final.
- **Rediseño de roles + permisos (fusionados en un solo trabajo)** — **decisión tomada, construcción pospuesta a propósito hasta que Rober lo pida.** Se confirmaron 5 roles: `mesero`, `cajero`, `gerente`, `admin` (control total, sin cambios), `contador` (nuevo, solo lectura de Dashboard/Reportes). Diseño: `permisos` (catálogo de capacidades) + `rol_permisos` (matriz rol↔permiso) + función `tiene_permiso(clave)`, con matriz editable en `/mas/permisos`. Reemplaza la deuda técnica de columnas booleanas sueltas en `config_sistema` (`descuentos_mesero`, `cancelaciones_mesero`, `cancelar_pedido_mesero` se migran a filas de `permisos`, sin borrar las columnas viejas todavía). **Aclaración importante:** solo los permisos por rol se mueven a tabla — la configuración de negocio (umbrales, formatos) se queda en `config_sistema`, no depende de quién eres.

**Todavía sin spec, esperando alguna decisión tuya**: C6 (botón SOS, falta que confirmes qué debe hacer), Fase 8 completa (F8-01/02/03), 3 hallazgos de las conversaciones ChatGPT (límite de descuentos, modo de prueba, alertas por WhatsApp/Telegram), y la conversación de multi-tenant/SaaS vendible — **guardada explícitamente para el final de todo**, como pediste. (Bloque F ya no está en esta lista — decisión tomada y en construcción activa, ver sección propia abajo.)

## Bloque F — Identidad Visual (rediseño de pantallas, en curso)

Verde bosque (`#173F2E`, hover `#0F2E21`) decidido como color de marca — **nunca** para el semáforo de mesa (`lib/colorMesa.ts`, 5 estados: verde/naranja/azul/rojo/gris), que sigue siendo un sistema de color aparte con significado operativo propio. Reglas de diseño transversal (2 patrones de ícono, semáforo de 5 colores, moneda siempre con decimales, Header A/B) documentadas en `CLAUDE.md`.

**Fundación construida** (`frontend/src/components/ui/`): `tokens.ts` (brand, `formatCurrency`, escala `texto`/`espaciado`), `Boton.tsx`, `Sheet.tsx`, `Tarjeta.tsx`, `HeaderA.tsx`, `AccionIcono.tsx`. Los ~40 archivos que aún usan `bg-blue-600` **no se migran automáticamente** — se migran pantalla por pantalla al rediseñar cada una.

**`/mesas` — primera pantalla rediseñada, completa** (`MesasShell.tsx` + `mesas/page.tsx`):
- Header A con saludo personalizado, 3 accesos rápidos, Panel del turno (íconos con tinte verde bosque a 30px — antes 24px, compensado apretando `gap-x`/padding interno de la tarjeta en vez de tocar las etiquetas de 9px/11px, ver cálculo abajo —, compactado a una sola línea — etiquetas de una palabra, `justify-between` para repartir los tiles a lo ancho completo en vez de amontonarse a la izquierda, `flex-nowrap` + `overflow-x-auto` solo como colchón para pantallas genuinamente angostas, nunca envuelve a 2 filas), toggle Mapa/Lista (ícono `LayoutGrid`, igual al bottom nav), leyenda de 5 colores restyled (chips, sin cambiar estados).
  - **Cálculo a mano del ícono a 30px** (estimado por ancho de carácter, no medido en dispositivo real — pendiente de confirmación de Rober en celular, igual que rondas anteriores de este panel): a 375px de pantalla, `px-3` de la sección (24px) + `px-2` de la tarjeta (16px, antes `px-2.5`/20px) dejan ~335px útiles. Con `gap-x-1.5` (6px×4=24px, antes `gap-x-2`/32px) más los 5 tiles (Mesas≈30px por el ícono, Clientes≈44px por la etiqueta, Ticket≈39px, Tiempo≈39px, Cobrado≈58.5px en el caso más ancho de un total de 4 cifras) suman ≈210.5px de contenido + 24px de gaps = ≈234.5px — deja ~100px de holgura dentro de los 335px disponibles, cómodo incluso si la estimación de ancho de carácter está algo corrida.
- **Campana de notificaciones centralizada** (`SheetNotificaciones.tsx`) — agrupa alertas de ventas bajas y precuenta impresa sin cobrar; el semáforo de mesa NO se duplica ahí.
- **Turno desplegable, solo Admin** (`SheetTurnos.tsx`, `?turno=<id>` en `/mesas`) — ve los últimos 10 turnos cerrados en modo de solo lectura (`cargarPanelTurnoHistorico()` en `mesas/page.tsx`, queries directas, sin RPC — mismo patrón que Corte Z, que tampoco usa RPC). El mapa de mesas siempre es en vivo; solo el Panel del turno cambia a histórico, con aviso "Viendo Turno #N — cerrado" y el tile "Cobro pendiente" relabeleado a "Total cobrado" (con tinte verde neutro, no rojo — ese color es solo para la alerta de cobro pendiente en vivo).
- **Fila "Órdenes activas"** (Cocina + Cobro, sin "Servir" ni "Reservas" — no existen esos datos/esa feature) — tiles tocables que navegan a `/pedidos?filtro=cocina|cobro` (soporte de filtro agregado a `PedidosShell.tsx`).
- Tarjetas de mesa (mapa y lista) recuperaron comensales/tiempo/monto con íconos chicos — en el mapa solo para tamaño medio/grande (en "chico", 52px, no cabía legible).
- **Permiso nuevo `config_sistema.panel_turno_mesero_financiero`** (migración `20260801000024`, sin aplicar) — sin él, un mesero solo ve Mesas/Clientes/Tiempo en el Panel del turno; Ticket y Cobro quedan ocultos hasta que Admin lo active en `/mas/permisos` (Admin siempre ve los 5).

- **Fix: Clientes/Ticket promedio/Tiempo promedio en $0.00 tras cobrar y cerrar mesas** — esos 3 tiles solo miraban `pedidosAbiertos`, así que en cuanto se cobraba y cerraba la última mesa del turno se iban a cero pese a que el turno sí tuvo actividad. Ahora son acumulados de todo el turno vía `cargarMetricasAcumuladasTurno()` (nueva, compartida con `cargarPanelTurnoHistorico()` — un turno cerrado es solo el caso donde ya no queda ningún pedido abierto, así que la misma función cubre ambos sin duplicar la query): `clientes` suma TODOS los pedidos del turno (abiertos + cerrados), `ticketPromedio`/`tiempoPromedioMin` solo los YA CERRADOS (una cuenta abierta no tiene total final ni duración completa de visita). Mesas ocupadas y Cobro pendiente se quedaron en vivo, sin cambio — no tienen equivalente histórico razonable. Verificado contra la base real (turno activo #30, sin pedidos abiertos ahorita): viejo cálculo dio clientes=0/ticket=$0.00/tiempo=0min; nuevo dio clientes=29, ticket=$151.73, tiempo=171min (de 11 pedidos cerrados, $1,669.00 cobrado) — y se confirmó por separado que `cargarPanelTurnoHistorico()` sigue dando exactamente los mismos pedidos que antes del refactor para un turno ya cerrado (turno #29, mismos 4 IDs).

**Comanda (`/pos/[pedidoId]`, tab Comanda) — segunda pantalla rediseñada, completa** (`PosShell.tsx` + `VistaComanda.tsx` + `ItemComanda.tsx`, contra `docs/mockups/02-comanda-menu.png`). Cambio puramente visual — ninguna server action ni lógica de negocio tocada.
- **`components/ui/HeaderB.tsx`** (nuevo, reusable) — primera implementación de Header B (flecha atrás + título + acción a la derecha), fundación para el resto de pantallas de detalle.
- **`components/ui/AccionPill.tsx`** (nuevo) — variante horizontal en píldora del patrón "acción con ícono" (regla #1), para la fila Compartir/Mover/Reasignar bajo Header B — distinta de `AccionIcono.tsx` (círculo grande + etiqueta abajo, pensado para grillas tipo Mesas), misma familia conceptual (ícono+etiqueta, nunca chip de filtro).
- **Unir/Separar mesa** (funcionalidad real que el mockup no contempla, y que puede coexistir con Compartir/Mover/Reasignar — no son mutuamente excluyentes) — decisión con Rober: se agrupan detrás de un botón "Más" al final de la fila, que abre un sheet chico con "Unir mesa"/"Separar mesa" (cada una visible solo si su condición ya existente sigue aplicando); el botón "Más" desaparece por completo si ninguna de las dos aplica.
- **Manija de arrastre del mockup (⋮⋮ junto a cada producto)** — no existe reordenar por drag-and-drop en la app real; decisión con Rober: se omite en vez de dibujarla sin función (evitar una promesa visual falsa).
- Tarjetas de comensal ahora son expandibles (chevron, estado de vista local `colapsados` en `VistaComanda.tsx` — no toca datos, todas expandidas por default), con badge circular de número, pill "N productos", "N pendiente(s)" + caption "Total comensal".
- Líneas de producto (`ItemComanda.tsx`): badge de estado restyled con ícono (Pendiente=ámbar/reloj, Enviado=verde/check, Cancelado=rojo/ban — antes Pendiente usaba azul, no coincidía con el mockup), acciones "Cambiar comensal"/"Cancelar producto" como círculo con tinte + etiqueta chica (mismo patrón, escala mini).
- Pie fijo: "Enviar a cocina" se queda **azul** (no verde bosque) tal como el mockup — Cobrar es la única acción de marca ahí; ambos con ícono + sub-etiqueta (conteo de pendientes / monto).
- Semáforo de mesa (regla #2) no aplica en esta pantalla — no hay ningún indicador de color de mesa en Comanda.

**Menú del POS (`/pos/[pedidoId]`, tab Menú) — tercera pantalla rediseñada, completa** (`VistaMenu.tsx`, contra `docs/mockups/03-mesa-menu.png`; el header/tabs/Header B ya construidos para Comanda no se tocaron, el mockup de esta ronda traía un header genérico tipo A que se ignoró a propósito).
- Chips de categoría restyled a "chip de filtro" real (píldora sin ícono, activa = fondo verde bosque sólido) — antes eran tabs con borde inferior azul.
- **Búsqueda de productos — no existía.** El encargo decía "la funcionalidad ya existe", pero `VistaMenu.tsx` no tenía ningún input de búsqueda ni estado asociado. Se agregó como filtro client-side simple (substring sobre `nombre`, sin acentos/case-insensitive básico) sobre los productos ya cargados — no toca ninguna query ni server action. Sin ícono de escaneo ni botón de filtro aparte del de categoría/nombre: ninguno de los dos tiene función real detrás en esta pantalla, mismo criterio ya aplicado a la manija de arrastre de Comanda (no prometer una función que no existe).
- Tarjetas de producto: imagen real (`productos.foto_url`, mismo patrón `<img>` que `SeccionProductos.tsx` en Catálogo — antes esta pantalla no pedía `foto_url` en su query, solo `emoji`; ahora cae a emoji si no hay foto) + nombre + badges REALES únicamente (categoría vía `categoria_id`→`categorias.nombre`; "Personalizable" si `es_combo`; "Agotado" si `!disponible`, mismo rojo de siempre) — se omitieron a propósito "Más vendido"/"Picante"/"Vegetariano" del mockup: no existe ningún campo en `productos` que los respalde, e inventar esa columna/lógica quedaba fuera de un cambio "puramente visual".
- Botón `+`/`−` cuadrado verde bosque (antes círculo azul).
- Pie fijo: "Nuevo comensal" sólido verde bosque + "Siguiente (X de Y)" ahora en contorno verde bosque (antes ambos sólidos, verde y azul) — el mockup lo muestra así; distinto del "+ Agregar producto"/"+ Nuevo comensal" **punteados** que viven dentro de las tarjetas de comensal en la pestaña Comanda (esos no se tocaron, siguen igual).

**Sheet de personalización de producto (`SheetModificadores.tsx`) — cuarta pantalla rediseñada, completa** (contra `docs/mockups/04-producto-sheet.PNG`). Primera migración real de un sheet hecho a mano al componente compartido `components/ui/Sheet.tsx` (según la política de CLAUDE.md: "se migran pantalla por pantalla, cuando se rediseñe cada una") — se extendió `Sheet.tsx` con `header?: ReactNode` (reemplaza la barra de título por defecto cuando hace falta más que texto: imagen+precio+botón cerrar propio) y `maxHeightClass` (default `85vh`, este sheet necesita `92vh`), retrocompatible con los ~5 sheets que ya usan `title`.
- Header: imagen real (`foto_url`, fallback emoji) + nombre + "Personaliza tu pedido" + precio base (verde) + botón X circular.
- Layout de opciones por grupo, 3 modos (ninguno es un campo nuevo en la BD, se infieren de `maximo`/conteo de opciones ya existentes): única + ≤5 opciones → tarjetas en fila con scroll horizontal (ej. Tamaño); única + >5 → lista de radio buttons **circulares** (el mockup dibuja cuadrados para este grupo pese a ser selección única — se usó círculo para no sugerir multi-selección donde no la hay); múltiple → grid de 2 columnas que envuelve (ej. adicionales).
- **Badge del grupo**: se quitó el badge+caja morada "Condicional" que existía antes (un grupo condicional visible ahora se ve igual que cualquier otro; la lógica de *visibilidad* vía `opciones_padre`/`grupoVisible()` no cambió en absoluto, solo el badge que lo anunciaba). El badge dinámico "✓ Listo"/"Elige N" de un grupo requerido **sí se conservó** (primera pasada lo había simplificado a un "Requerido" estático por error — Rober lo corrigió: es retroalimentación funcional real, no decoración, permite ver de un vistazo si falta completar un grupo antes de agregar a la comanda).
- Resumen del pie: las selecciones de un grupo "tarjeta" se muestran en mayúsculas (ej. "CHICO · Surtido con pata") — heurística visual, mismo criterio de conteo de opciones que decide el layout (no hay un campo real que marque "este grupo es el de tamaño").
- Se eliminó código de debug muerto (`console.log`+contador de renders en un `useEffect`) que quedó de una sesión anterior, sin relación con el rediseño.
- El campo "Nota para cocina" no aparece en el mockup pero es funcionalidad real (llega al ticket de cocina) — se mantuvo, solo restyled.
- Nota menor: al migrar al `Sheet` compartido, el espaciado vertical entre grupos pasó de `space-y-5` (20px) a `space-y-3` (12px, el default del componente) — más apretado que antes, pero consistente con el resto de sheets del proyecto.

**Corrección — control real de estilo_visual por grupo (ya no inferido por conteo de opciones).** Rober pidió reemplazar la heurística (≤5 opciones → tarjetas, >5 → lista) por un campo real: `grupos_modificadores.estilo_visual TEXT NOT NULL DEFAULT 'cajas' CHECK (IN ('cajas','lista','chips'))` — migración `20260801000025`, **sin aplicar** (el `CHECK` se amplió a 3 valores editando ese mismo archivo de migración en vez de sumar uno nuevo, porque nunca se había aplicado — ver ronda siguiente). Selector de 3 vías "Cajas/Lista/Chips" en el form de grupo en Catálogo (`SeccionProductos.tsx`). Los layouts se redujeron a 3 opciones explícitas: 'cajas' = grid de 4 columnas que siempre envuelve dentro del ancho de pantalla (aplica tanto a selección única como múltiple), 'lista' = filas de ancho completo (soporta selección múltiple con cuadrado en vez de círculo), 'chips' = píldoras compactas que envuelven (mismo patrón visual que los chips de categoría de `VistaMenu.tsx`, pero con `flex-wrap` en vez de scroll horizontal), sin ícono de check — el estado activo se marca solo con relleno de color, única excepción a la regla círculo/cuadrado (que sigue viniendo de `grupo.maximo`, independiente del estilo, para 'cajas'/'lista').
- **⚠️ Dependencia de despliegue**: `cargarModificadores()` (usada tanto por el sheet de personalización en POS como por el editor de Catálogo) ahora hace `SELECT estilo_visual` de `grupos_modificadores` — hasta que la migración `20260801000025` se aplique con `supabase db push`, esa columna no existe en la base real y **la query fallará** (no es un caso de columna nullable con default silencioso: Postgres rechaza seleccionar una columna que no existe todavía). Este cambio no debe desplegarse a producción antes de aplicar la migración.
- De paso se limpiaron 3 `console.log`/`console.error` de debug en `cargarModificadores()` (actions.ts), sin relación funcional con este cambio.

**SheetCapturaPida.tsx (Modo captura rápida) — quinta pantalla rediseñada, completa** (contra `docs/mockups/09-captura-rapida.png`). La funcionalidad de selección múltiple con cantidad por presentación ya existía (`ajustar()`, total corriendo, confirmar) — se confirmó antes de tocar nada. Se construyeron 2 piezas que NO existían: **búsqueda** ("Buscar presentación…", filtro client-side simple sobre lo ya cargado, mismo patrón que Menú) y **chips de categoría** — resultó que las "categorías" del mockup (Clásicos/Guisados/Vegetarianos) son literalmente los `grupos_modificadores` con `mostrar_en_rapido=true` de ese producto (ya soportaba varios grupos por producto, solo no se exponían como filtro); "Todas" es la unión. El botón "Filtros" del mockup se omitió — redundante con los chips, sin función propia (mismo criterio que el escaneo/filtro ya omitidos en Menú y Comanda). También se agregó "Limpiar selección" (no existía, resetea todas las cantidades a 0 — solo toca estado de vista, no server actions).
- **`opciones_modificador.foto_url TEXT` (nullable)** — nuevo campo. Antes solo el producto completo tenía imagen; ahora cada opción/guisado puede tener la suya. En Catálogo, el editor de opción de modificador tiene un campo de imagen opcional que **reutiliza `subirImagenProducto()`** (mismo bucket "productos", sin duplicar lógica de subida).
- Dondequiera que se muestre imagen por opción (tarjetas de Captura rápida, y el estilo 'cajas' de `SheetModificadores.tsx`): `opcion.foto_url` si existe, si no cae en `producto.foto_url`/`emoji` del producto padre — una opción sin imagen propia se sigue viendo bien en vez de quedar vacía. Los estilos 'lista'/'chips' no muestran imagen (a propósito, son los estilos compactos).
- De paso se limpiaron 5 `console.log`/`console.error` de debug más en `cargarGuisados()` (actions.ts).
- **⚠️ Incidente de migraciones**: `foto_url` se había agregado por error a la migración `20260801000025`, pero esa migración **ya estaba aplicada** en producción para ese momento (solo con `estilo_visual`) — el CLI de Supabase no vuelve a correr un archivo ya marcado como aplicado, así que la columna nunca llegó a la base por ese camino; se aplicó por fuera del sistema de migraciones. Se corrigió: `20260801000025` se revirtió a su contenido original (solo `estilo_visual`), y se creó `20260801000026_opciones_modificador_foto_url.sql` (con `IF NOT EXISTS`, segura de correr aunque la columna ya exista) para dejar el historial del repo consistente con la base real. Se agregó una regla nueva a `CLAUDE.md`: nunca editar una migración ya aplicada, siempre crear una nueva.

**Corrección — Modo captura rápida (Tacos)**: 3 ajustes contra el mismo mockup.
- **Layout de tarjeta horizontal** (revertido después — ver siguiente ronda): la cuadrícula de 2 columnas con imagen arriba pasó a una lista de una columna con filas horizontales — thumbnail a la izquierda, nombre/precio/stepper a la derecha. Nota de honestidad en su momento: el mockup real (`docs/mockups/09-captura-rapida.png`) mostraba tarjetas verticales, no horizontales; el cambio se hizo por la descripción explícita de Rober, no por el archivo. Quedó pendiente de confirmación visual — la ronda siguiente pidió deshacerlo.
- **Botón "Filtros"**: se agregó junto al buscador (ícono sliders). No es decorativo — controla un filtro real ("ocultar agotados", sobre `disponible`), no una función inventada. Este sí se queda.
- **Chips de categoría — diagnóstico**: el código de la ronda anterior (`grupos.length > 1`, `cargarGuisados` agrupando por `mostrar_en_rapido`) no tenía bugs — se confirmó consultando la base real. La causa de que no aparecieran para "Tacos" (producto id 11) es que solo tenía **un** grupo activo con `mostrar_en_rapido=true` ("Guisados"); los otros dos que existían ("Barbacoa", "extras") estaban con `activo=false` en Catálogo — con un solo grupo activo el filtro es redundante a propósito y el guard lo ocultaba. Diagnóstico correcto, pero el mecanismo en sí (categorías = grupos separados) se reemplazó en la ronda siguiente por ser poco práctico en general (normalmente hay un solo grupo `mostrar_en_rapido` activo, así que nunca hay más de una "categoría" real que ofrecer).

**Corrección 2 — Modo captura rápida**: 2 ajustes más sobre la ronda anterior.
- **Se deshizo el layout horizontal**: Rober confirmó que el mockup real es vertical (imagen arriba) y que prefiere quedarse con eso — se restauró la cuadrícula de 2 columnas con imagen arriba de 88px tal como estaba antes de la corrección anterior. El botón "Filtros" (ocultar agotados) del ajuste anterior se queda, no se tocó.
- **Nuevo mecanismo de chips — `opciones_modificador.etiqueta_captura_rapida TEXT` (nullable)**, migración `20260801000027` (nueva, sin reutilizar ninguna de las ya aplicadas — ver [[feedback_migraciones_no_editar_aplicadas]]). Reemplaza por completo el mecanismo de "categorías = grupos separados con `mostrar_en_rapido`" (que en la práctica casi nunca tenía más de un grupo activo, por eso las chips nunca se veían). Ahora la categorización es por **opción individual**, sin importar de qué grupo venga: en Catálogo, el editor de opción de modificador tiene un campo "Categoría en captura rápida (opcional)" con `<datalist>` de sugerencias — las etiquetas ya usadas en las demás opciones del mismo grupo — para evitar variantes de tecleo ("Guisado" vs "Guisados"). En `SheetCapturaPida.tsx`, las chips se arman a partir de las etiquetas distintas presentes entre **todas** las opciones cargadas (de todos los grupos `mostrar_en_rapido` del producto, ya aplanadas — los grupos dejaron de ser el criterio de agrupación), en orden de primera aparición, más "Todas (N)" al inicio. Una opción sin etiqueta solo cuenta para "Todas", no queda excluida de nada. Las chips solo se muestran si al menos una opción tiene etiqueta.
- `cargarModificadores()` (usada también por el editor de Catálogo, no solo por `cargarGuisados()`) también agrega `etiqueta_captura_rapida` a su `SELECT` de `opciones_modificador`, porque el editor de opción en `SeccionProductos.tsx` carga las opciones existentes por ese camino.
- **⚠️ Dependencia de despliegue**: hasta que `20260801000027` se aplique con `supabase db push`, `cargarModificadores()` y `cargarGuisados()` fallarán (ambas ya seleccionan la columna nueva). No desplegar antes de aplicar la migración.

**Ticket de cliente impreso (`raspberry-pi/print_server.py`)** — 3 ajustes contra `docs/mockups/10-ticket-formato-deseado.png`.
- **Bug real de corte de palabras a la mitad, corregido**: la impresora no hace su propio ajuste de línea, así que cualquier texto más largo que el ancho disponible se cortaba a mitad de palabra en el papel físico. Nuevo helper `_envolver_texto(texto, ancho, sangria_continuacion='')` (usa `textwrap.wrap()`) — reserva el ancho de `sangria_continuacion` en todas las líneas devueltas (incluida la primera), para que el llamador anteponga su propio prefijo de igual longitud a la primera línea y la sangría a las demás, quedando alineadas. Aplicado en 2 lugares: el nombre del negocio (`_encabezado_cliente`, fuente doble ancho → ancho útil `COL // 2` = 16, no 32) y las líneas de modificadores (`_item_cliente`, prefijo `'  + '` de 4 espacios, sangría de continuación de 4 espacios). Verificado offline con textos largos simulados (sin impresora física) — envuelve correctamente sin cortar palabras. La línea `"  $X.XX c/u"` (cantidad > 1) no se tocó, tal como se pidió.
- **`config_sistema.ticket_subtitulo TEXT` (nullable)** — migración nueva `20260801000028` (no se reutilizó ninguna migración ya aplicada, mismo criterio que [[feedback_migraciones_no_editar_aplicadas]]). Antes el nombre del negocio no tenía forma de llevar un subtítulo aparte (ej. "Fonda & Artesanías") — ahora es su propia línea en fuente normal, debajo del nombre en doble ancho. Editable en `/mas/configuracion` (`TicketConfigShell.tsx`, junto al resto de campos `ticket_*`) — **no** en `/mas/permisos`, porque es texto del ticket impreso, no un ajuste numérico (ver regla de CLAUDE.md sobre dónde vive cada cosa). Se propagó el campo `subtitulo` en el tipo `TicketConfig` (`lib/print.ts`) y en los 5 lugares que arman ese objeto para enviarlo al print server: `mas/configuracion/page.tsx`, `mas/corte-z/page.tsx`, `cobro/[pedidoId]/page.tsx`, `pos/[pedidoId]/page.tsx`, `historial/actions.ts`. Nota de nombres: en Python, el parámetro `subtitulo` de `_encabezado_cliente()` ya existía para la etiqueta de escenario ("** PRE-CUENTA **", "COMENSAL: X") — es un concepto distinto del subtítulo del negocio (`config['subtitulo']`), se dejó comentado en el código para no confundirlos.
- **Encabezados de columna "CANT. PRODUCTO IMPORTE"**: nuevo helper `_encabezado_columnas_items()`, alineado a los 32 caracteres de `COL` igual que las filas de `_item_cliente` (cantidad+nombre a la izquierda, importe al margen derecho), con su propia línea de guiones debajo. Se agregó antes de cada lista de items en los 4 escenarios que la tienen: `precuenta`, `global`, `individual` (dentro del loop por comensal), `varios` (reemplazando ahí la línea de guiones suelta que ya existía, para no duplicarla).
- **⚠️ Dependencia de despliegue**: hasta que `20260801000028` se aplique con `supabase db push`, las 5 queries que ya seleccionan `ticket_subtitulo` de `config_sistema` fallarán contra la base real. Y, por separado, el archivo `print_server.py` no se actualiza solo en la Raspberry Pi — falta el `scp` manual a `admin@192.168.1.16` + `sudo systemctl restart griselda-print` de siempre.
- Nota de honestidad: el mockup también muestra separadores punteados (`---`) entre nombre/dirección, entre dirección/mesa-mesero-fecha, y entre esa sección y "** PRE-CUENTA **" — el ticket actual no los tiene y no se agregaron, porque no eran parte de los 3 puntos pedidos explícitamente. Se deja anotado por si se quiere como ajuste aparte.

**Corrección 2 — Ticket de cliente**: 3 ajustes puntuales pedidos con alcance explícitamente restringido a `print_server.py` (sin BD nueva, sin datos ficticios, separadores `====`/`----` intactos). Antes de codear se detectó un conflicto real: el encabezado pedido necesita mesero/orden/comensales/tipo, pero el payload que hoy llega al print server para tickets de cliente **no incluía ninguno de esos campos** (solo el ticket de cocina los tenía) — se preguntó y Rober aprobó una excepción mínima para propagarlos.
- **Encabezado reestructurado**: la línea `"{mesa} — {fecha}"` se reemplazó por un bloque de 3-4 líneas — `MESA X · N COMENSALES` (o `CLIENTE: NOMBRE · N COMENSALES` para `tipo='llevar'` con `cliente_nombre`, o solo `N COMENSALES` sin nombre, o nada para `tipo='mostrador'` — ver `_linea_encabezado_servicio()`), `MESERO: X          ORDEN #N`, `SERVICIO: SALON/PARA LLEVAR/MOSTRADOR`, fecha. Todo defensivo: valores `None`/vacíos nunca se imprimen literalmente (`_linea_encabezado_servicio` devuelve `''` y se omite la línea; mesero cae a "SIN REGISTRAR" si falta).
- **Excepción mínima aprobada** para llevar datos reales al payload (nada se inventó): `lib/print.ts` (nuevo tipo `DatosServicioTicket` con `mesero/orden/tipoMesa/numComensales/clienteNombre`, mezclado en los 2 variantes de `PrintPayload['cliente']`), `cobro/[pedidoId]/page.tsx` (agrega `mesero_id, num_comensales, cliente_nombre` al select de `pedidos`, resuelve el nombre del mesero vía `perfiles` + **`primerNombreValido()`** — mismo patrón que el resto de la app, no lógica nueva), `components/cobro/CobroShell.tsx` (5 props nuevas, propagadas en las 4 llamadas a `imprimirTicket({tipo:'cliente', ...})`), `historial/actions.ts` (mismo patrón para la reimpresión: extiende el `select` anidado de `pedidos` y resuelve mesero igual). El campo `mesa`/número de mesa en sí **no cambió** — se sigue reutilizando el mismo dato que el ticket ya usaba.
- **Orden de impresión de cada producto**: en `_item_cliente()`, el bloque `"  $X.XX c/u"` se movió de antes de los modificadores a después — puro reordenamiento, sin tocar cálculo, precios, cantidades ni cómo se arman los modificadores.
- **Espacio antes del mensaje final**: en `_pie_cliente()`, el primer `CMD_LF * 4` (entre el `====` y "Gracias por su visita…") bajó a `CMD_LF * 1`. El segundo `CMD_LF * 4` (después del mensaje, antes del corte) no se tocó.
- Cocina (`_encabezado_cocina`, `_seccion_comensal`, `_build_cocina`) no se tocó en absoluto, tal como se pidió.
- Verificado offline (sin impresora física, importando el módulo con un stub de `flask`) con el ejemplo exacto que dio Rober (Mesa 1, 2 comensales, Roberto, orden 187, salón, Café/Menudo/Agua fresca) — el resultado línea por línea coincide con el formato pedido.
- **Pendiente de Rober**: revisar el resumen/ejemplo, aplicar `20260801000028` con `supabase db push` (declarada en la ronda anterior, aplica también aquí porque las páginas de cobro/historial ya seleccionaban `ticket_subtitulo`, sin relación con este cambio pero mismo bloqueo), y el `scp` + `systemctl restart griselda-print` manual de siempre. Nada de esto se hizo todavía.

**Pendiente de Bloque F**: migrar el resto de pantallas (Cobro, Pedidos, Historial, Dashboard, Más, etc.) a Boton/Sheet/Tarjeta + verde bosque, una por una.

---

## Ticket de cliente (texto_natural) + manejo global de errores de carga

- **`lib/descripcionNatural.ts`** — se separó `construirFraseModificadores(grupos)` (solo la frase, sin nombre) de `construirDescripcionNatural(nombre, grupos)` (que ahora la usa internamente). `VistaComanda.tsx` (comanda de cocina) sigue igual, sin cambios de comportamiento.
- **Ticket de cliente con `formato_modificadores_ticket === 'texto_natural'`** (`cobro/[pedidoId]/page.tsx` y `historial/actions.ts::reimprimirTicketCliente`, mismo bug en ambos por ser el mismo patrón duplicado) — antes juntaba nombre + frase de modificadores en una sola línea larga, descuadrando el precio contra `_item_cliente()` en `print_server.py`. Ahora `nombre` se manda puro y la frase entra como única entrada de `modificadores`, reusando el mecanismo que ya imprime modificadores en su propia línea debajo (`  + frase`). Sin cambios en `print_server.py` — `_item_cliente()` ya soportaba esto, el bug era solo de cómo se armaba el payload.
- **`global-error.tsx`** (raíz, con su propio `<html>/<body>`, estilos inline por resiliencia) y **`(app)/error.tsx`** (dentro del layout, hereda BottomNav) — capturan pantalla en blanco al navegar. `lib/errorCarga.ts::esErrorDeCarga()` detecta `ChunkLoadError`/mensajes de import dinámico fallido típicos de un deploy nuevo en Vercel mientras la app ya estaba abierta → recarga automática con mensaje "Actualizando…". Cualquier otro error se muestra normal con botón "Reintentar" (`reset()`), sin ocultar bugs reales detrás de un reload silencioso.

---

## Próxima vez que actualices este documento

Cuando implementes cualquier cosa de la lista de "Todavía NO listos" (ver el documento de spec correspondiente — Bloque E, Bloque A, C6, etc.), regresa aquí y agrega su renglón. Este documento solo es útil si se mantiene al día — ya se dejó pasar una vez, no conviene que se repita.
