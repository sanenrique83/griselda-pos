# Griselda POS — Instrucciones Persistentes para Claude Code

Restaurante POS para La Menudería (El Arenal, Jalisco). Next.js 16 (App Router) + React 19 + TypeScript + Supabase, desplegado en Vercel. Impresión térmica vía Raspberry Pi + Flask, expuesto por Cloudflare Tunnel.

## Al terminar cualquier tarea

Actualiza `docs/ESTADO_PROYECTO.md` reflejando lo que se hizo (mover de ⚪ a ✅ lo que corresponda, agregar hallazgos nuevos a "Recomendaciones abiertas" si aplica). Es el documento de estado consolidado del proyecto — mantenlo al día sin que se te tenga que pedir explícitamente cada vez.

## Estructura del repo — crítico

- El código de Next.js vive en `frontend/`, **no en la raíz**. El Root Directory de Vercel está configurado a `frontend/`.
- El print server de la Raspberry Pi vive en `raspberry-pi/print_server.py`.
- Rutas con paréntesis de App Router (ej. `(app)`) necesitan comillas al usarlas en bash.

## Print server — errores recurrentes a evitar

- **Nunca uses la librería Python `escpos`** — no está instalada en la Pi. El print server usa sockets TCP crudos directo al puerto 9100 del Volteck PDV-81I (`192.168.1.100:9100`). Esto se ha reescrito mal más de una vez; revisa el patrón existente en el archivo antes de tocar algo.
- **El código nuevo no se despliega solo en la Pi.** Después de aprobar un cambio a `print_server.py`, el usuario debe copiarlo manualmente (`scp` a `admin@192.168.1.16:/home/admin/print_server.py`) y reiniciar el servicio (`sudo systemctl restart griselda-print`) — nunca asumas que ya está corriendo la versión nueva solo porque se subió a GitHub.
- Verifica siempre `python3 -m py_compile raspberry-pi/print_server.py` después de editar ese archivo.

## Migraciones — flujo de trabajo

- El proyecto está vinculado al Supabase CLI. El usuario aplica las migraciones él mismo con `supabase db push` **después de revisar el código** — nunca las apliques ni las des por aplicadas sin que él lo confirme.
- Antes de asumir que una columna/tabla "no existe" porque no aparece en las migraciones versionadas, considera que puede existir en la base real sin haber pasado por una migración (ya ha pasado varias veces — ej. `productos.orden`, `categorias.modo_captura`, las columnas `ticket_*`). Si tienes acceso, confírmalo contra la base real antes de reportarlo como ausente.
- Usa `ADD COLUMN IF NOT EXISTS` como hábito, no solo cuando se sospeche un conflicto.
- **Nunca edites un archivo de migración que ya fue aplicado** — el CLI de Supabase no vuelve a correr un archivo ya marcado como aplicado, así que un cambio agregado ahí después nunca llega a la base por ese camino (ya pasó: se agregó `opciones_modificador.foto_url` a una migración que ya estaba aplicada y la columna nunca se propagó; hubo que aplicarla por fuera y crear una migración nueva para dejar el historial consistente). Si hay duda de si una migración ya se aplicó, confirma con `supabase migration list` (o el equivalente) antes de tocarla. Siempre crea un archivo nuevo para el cambio, aunque sea chico, para que `supabase db push` lo detecte y lo corra.

## Dónde viven las cosas — no asumas

- **Ajustes numéricos/de configuración de `config_sistema`** (timeouts, umbrales, permisos, modificadores por línea, etc.) van en `/mas/permisos`, **no** en `/mas/configuracion` — esa pantalla es exclusivamente texto del ticket impreso (`ticket_nombre`, `ticket_pie`, etc.), pase lo que pase con el nombre.
- La receta/costeo de un producto se administra en **Inventario → Recetas** (pantalla dedicada), no en Catálogo directamente — Catálogo solo enlaza hacia allá.
- Antes de asumir dónde vive una pantalla o función existente, búscala — varias veces ya se ha encontrado que el nombre de una pantalla no coincide con lo que hace (ej. "Impresoras" e "Configuración" no son lo mismo que sus nombres sugieren a primera vista).

## Reutilizar antes que duplicar

Este proyecto tiene varios patrones ya establecidos — reutilízalos en vez de inventar uno paralelo:
- "Guardar todo de una vez" (borrar + reinsertar): `guardarGrupoPadres()`, `guardarComboComponentes()`, `guardarComboSlots()`.
- Reordenamiento por arrastre: `ListaArrastrable.tsx` (usa `@dnd-kit/core`, sin `@dnd-kit/sortable`).
- Validación de condición de carrera al abrir/unir mesas: mismo patrón en `abrirPedidoMesa()`, `abrirPedidoMesaCombinada()`, `unirMesaLibreAOcupada()`, `moverPedidoDeMesa()`.
- Geometría de sillas: `calcularPosicionesSillas()` (mesa individual) / `calcularPosicionesSillasCadena()` (mesas unidas) en `lib/asientos.ts` — nunca calcules posiciones de silla de otra forma.
- Botón "Regresar" a `/mas`: componente compartido `BotonRegresarMas.tsx`.

## El motor de recetas — modelo actual (no uses versiones anteriores mencionadas en el historial)

Modelo de **dos niveles**: los insumos pueden ser `comprado` o `derivado` (con su propia receta en `insumo_receta`, repuesto vía producción). El porcionado de un producto (`receta_insumos`) es simple: `(receta_id, insumo_id, cantidad_usada)`, sin ninguna columna de "opción". La relación con modificadores se resuelve vía `opciones_modificador.insumo_id` — si el insumo de una fila de receta coincide con el insumo de una opción del producto, esa fila es "variable" (solo se consume si esa opción fue elegida); si no coincide con ninguna opción, es "de siempre". `aplicar_consumo_receta()` ya implementa esta lógica — no la reinventes.

## Reglas de diseño transversal — aplican a cualquier rediseño de pantalla

Referencia común antes de tocar el diseño de una pantalla individual. Ver también `frontend/src/components/ui/tokens.ts`.

1. **Dos patrones de ícono, nunca mezclados**: "acción con ícono" (círculo/cuadrado con tinte de color + etiqueta debajo, para acciones contextuales como Compartir/Mover/Cobrar) vs. "chip de filtro" (píldora de solo texto, sin ícono, para categorías y filtros de estado).
2. **Semáforo de mesa**: usa exactamente los colores/significados definidos en `lib/colorMesa.ts` (hoy: verde=libre, naranja=ocupada, azul=cobro parcial, rojo=sin atender, gris=fuera de servicio) en cualquier pantalla que muestre estado de mesa — nunca una variación local. `lib/colorMesa.ts` es la fuente única de verdad; no dupliques la paleta en otro archivo. Los estados de ciclo de vida de un pedido (Cerrada/Abierta/Cancelada, en Historial) son un sistema visual **distinto** (píldora con ícono, no color sólido de tarjeta) — no reutilices el semáforo de mesa para eso.
3. **Montos con decimales siempre** (`$X,XXX.00`, sin excepción) — usa `formatCurrency()` de `components/ui/tokens.ts` en vez de `.toFixed(2)` suelto en pantallas nuevas o rediseñadas.
4. **Header A vs. Header B**, composición fija cada uno:
   - Header A (pantallas raíz del bottom nav) = logo circular + nombre/marca + píldora de turno + campana de notificaciones.
   - Header B (pantallas de detalle) = flecha atrás + título + acciones contextuales a la derecha.
5. **Verde bosque de marca** (`brand.forest` = `#173F2E`, hover `brand.forestHover` = `#0F2E21`, en `components/ui/tokens.ts`) para header tipo A y acciones primarias de marca — **nunca** para el semáforo de mesa. `lib/colorMesa.ts` es un sistema de color aparte con significado operativo propio (libre/ocupada/etc.); no se mezcla con el verde de marca aunque ambos sean "verde".

## Componentes base de UI — Boton / Sheet / Tarjeta

Trabajo **nuevo** de botones, sheets o tarjetas usa `components/ui/Boton.tsx`, `components/ui/Sheet.tsx` y `components/ui/Tarjeta.tsx` (variantes primario/secundario/peligro/texto para Boton, verde bosque como color primario) — no clases de Tailwind sueltas copiadas de otro archivo. Esto es la fundación: los ~40 archivos que ya usan `bg-blue-600` u otros botones/sheets/tarjetas armados a mano **no se migran automáticamente** solo por existir estos componentes; se migran pantalla por pantalla, cuando se rediseñe cada una.

Recordatorio explícito (ya en la regla 5 de arriba, pero se repite aquí porque es fácil pasarlo por alto al tocar botones): el semáforo de mesas (`lib/colorMesa.ts`, `ESTILO_COLOR_MESA`) es un sistema de color aparte, con su propio significado operativo (libre/ocupada/cobro parcial/sin atender/fuera de servicio), probado y estable — **no** se alinea ni se reemplaza por el verde de marca aunque ambos usen tonos de verde.

## Verificación antes de reportar terminado

- `npx tsc --noEmit` desde `frontend/` después de cualquier cambio de TypeScript.
- `python3 -m py_compile raspberry-pi/print_server.py` después de cualquier cambio a ese archivo.
- Antes de reportar un bug como "esto está roto", verifica contra el comportamiento real si tienes forma de hacerlo (ej. vía introspección de base de datos) — ya ha pasado que un análisis solo de archivos concluye algo que no es cierto en producción.
