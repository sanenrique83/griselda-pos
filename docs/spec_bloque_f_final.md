# Griselda POS — Bloque F: Consistencia Visual (Fundación) — FINAL

Reemplaza el borrador anterior (que proponía verde agave apagado). Confirmado: **verde bosque**, el mismo de tus mockups.

## Un ajuste importante antes de los tokens

**El verde de marca y el verde de "mesa libre" en el semáforo no deben ser el mismo tono.** Si el botón "Enviar", la barra de navegación, y una mesa libre en el mapa usan exactamente el mismo verde, el ojo puede confundir "esto es un botón/marca" con "esta mesa está libre" — son significados distintos (uno es identidad, el otro es un estado que cambia constantely). Propongo:
- **Verde bosque** (marca): navegación, botones primarios, encabezados — el tono oscuro y saturado de tus mockups.
- **Verde de estado** (semáforo, mesa libre): un verde más claro y menos saturado, ya usado hoy en `ESTILO_COLOR_MESA` (`#22c55e` el punto, `#F0FDF4` el fondo) — se queda como está, no se toca, solo se confirma que es intencionalmente distinto del verde de marca.

## Tokens confirmados

- **Verde bosque (marca):** `#173F2E` — reemplaza `bg-blue-600` (confirmé: **40 archivos** lo usan hoy) como color primario de botones/navegación/acentos. Variante hover/activa más oscura: `#0F2E21`.
- **Fondo base:** `#F7F5F1` (blanco cálido tipo piedra — se queda igual que el borrador anterior, sigue siendo la elección correcta frente al fondo blanco genérico).
- **Texto principal:** `#2B2823` (carbón cálido, no negro puro — sin cambio).
- **Radio:** `rounded-xl` (tarjetas/sheets/inputs) y `rounded-full` (píldoras/avatares/badges) — sin cambio del borrador anterior.
- **Sombra de botón primario:** una sola fórmula parametrizada por color, ahora basada en el verde bosque: `shadow-[0_4px_14px_rgba(23,63,46,.32)]` en vez de las 8 variantes de azul que existen hoy.
- **Escala tipográfica:** los mismos 5 niveles semánticos del borrador anterior (título de pantalla 20px/bold, encabezado de sección 17px/semibold, cuerpo 15px, etiqueta 13px/gray-500, caption 11px/gray-400).
- **Espaciado:** los mismos 3 patrones del borrador anterior (`px-4 py-3` fila, `px-4 py-4` tarjeta, `px-5 py-4` sheet).

**El semáforo de mesas (`ESTILO_COLOR_MESA` en `lib/colorMesa.ts`) no se toca en este bloque** — ya tiene su propia paleta de 4-5 colores con significado operativo (verde/naranja/azul/rojo/gris/morada), independiente del verde de marca. Ya lo revisamos a fondo, funciona bien, y mezclarlo con este cambio de marca sería innecesariamente arriesgado.

## Componentes compartidos (sin cambio de estructura, solo de color)

```
frontend/src/components/ui/
├── Boton.tsx        — variantes: primario (verde bosque)/secundario/peligro/texto
├── Sheet.tsx         — contenedor base para sheets
├── Tarjeta.tsx       — contenedor de tarjeta/sección
└── tokens.ts         — constantes de texto/espaciado + el verde bosque como constante exportada
```

## Prompt sugerido para Claude Code

> Necesito establecer la base de consistencia visual para Griselda POS, con **verde bosque** (`#173F2E`, hover `#0F2E21`) como color de marca — reemplaza `bg-blue-600` como color primario de botones/navegación (confirmé que son 40 archivos hoy, pero **no los migres todavía**, esto es solo la fundación).
>
> Crea `components/ui/Boton.tsx` (variantes primario en verde bosque/secundario/peligro/texto, con una sola fórmula de sombra `shadow-[0_4px_14px_rgba(23,63,46,.32)]` para el primario, `rounded-xl`), `components/ui/Sheet.tsx` (contenedor base de sheets, `px-5 py-4`), `components/ui/Tarjeta.tsx` (`rounded-xl`, `px-4 py-4`), y `components/ui/tokens.ts` (verde bosque + hover como constantes, más los 5 tamaños de texto semánticos: tituloPantalla 20px/bold, encabezadoSeccion 17px/semibold, cuerpo 15px, etiqueta 13px/gray-500, caption 11px/gray-400).
>
> **Importante: no toques `lib/colorMesa.ts` ni `ESTILO_COLOR_MESA` en este cambio** — el semáforo de mesas es intencionalmente independiente del verde de marca, tiene su propio significado operativo y ya está probado. Confirma explícitamente en tu resumen que no lo tocaste.
>
> Agrega una sección corta a `CLAUDE.md`: trabajo nuevo de botones/sheets/tarjetas usa estos componentes con el verde bosque como color primario, no clases de Tailwind sueltas — y una nota explícita de que el semáforo de mesas es un sistema de color aparte, con su propio significado, que no debe alinearse al verde de marca.
>
> Corre `npx tsc --noEmit` desde `frontend/` y muéstrame un resumen. No necesita ninguna migración de base de datos.

## Parte 2 (migración incremental) — sin cambios de criterio

Se mantiene la misma recomendación: empezar por las pantallas de mayor uso diario (POS, `/mesas`), dejar Admin de uso ocasional para el final, una pantalla por sesión, revisando visualmente antes/después — no solo `tsc`.
