# Griselda POS — Resolución de Inconsistencias entre Mockups (fuente única)

Las 4 inconsistencias que señalé al analizar los mockups, cada una resuelta con **una sola decisión** que todas las pantallas deben seguir por igual. Esto se construye **antes** de tocar cualquier pantalla individual — cada prompt de rediseño (Mesas, Menú, Cobro, etc.) hace referencia a este documento en vez de interpretar su propio mockup de forma aislada.

## 1. Patrón de ícono+acción — dos categorías, no una mezcla

- **"Acción con ícono"** (ej. Compartir/Mover/Reasignar/Cobrar en el header de una mesa): ícono de `lucide-react` dentro de un círculo/cuadrado con tinte suave del color correspondiente, con una etiqueta corta debajo. Se usa en: acciones de mesa, y cualquier grupo similar de acciones contextuales.
- **"Chip de filtro"** (ej. Todos/Platillo/Comal/Bebidas, o Todas/Cocina/Servir/Cobro/Reservadas): píldora de solo texto, sin ícono, activa en verde bosque de marca / inactiva en gris claro. Se usa para categorías y filtros de estado — nunca lleva ícono, para no confundirse visualmente con el patrón anterior.
- El bottom nav es su propio tercer caso (ya establecido, ícono arriba + etiqueta abajo, dentro de la barra) — no cambia.

## 2. Semáforo de mesa — un solo mapeo de color, en las 6 pantallas que lo muestren

Este es el más importante — el mockup se contradecía a sí mismo (el mapa mostraba una mesa gris con reloj, pero la leyenda solo listaba 3 estados; la lista de Pedidos usaba otros 4 colores/etiquetas distintos otra vez). El sistema real ya tiene 6 estados definidos en `lib/colorMesa.ts` — **ese es el que manda**, no el de ningún mockup individual:

| Color | Significado |
|---|---|
| 🟢 Verde | Libre |
| 🟠 Naranja | Ocupada |
| 🔵 Azul | Cobro parcial en curso |
| 🔴 Rojo | Sin atender (alerta) |
| ⚪ Gris | Fuera de servicio |
| 🟣 Morado | Reservada (próxima) |

Toda pantalla que muestre estado de mesa (mapa, lista, filtros de Pedidos, cualquier badge) usa exactamente estos 6 colores con este significado — sin inventar una variación local.

**Aparte, no se debe confundir con esto:** los estados de un *pedido/cuenta* en Historial (Cerrada/Abierta/Cancelada) son una cosa distinta — el ciclo de vida de una cuenta, no la ocupación física de la mesa. Se muestran como una píldora de texto con ícono (check verde/reloj naranja/X roja), visualmente diferenciada del semáforo de mesa (que es un color sólido de tarjeta/punto), para que no se lean como el mismo sistema.

## 3. Formato de moneda — siempre con decimales

Todo monto en la app se muestra como `$X,XXX.00` — nunca `$X,XXX` sin decimales. Sin excepción, en ninguna pantalla.

## 4. Patrón de header — dos tipos, cada uno con su regla clara

- **Header A** (pantallas raíz del bottom nav: Mesas, Pedidos, Historial, Dashboard, Más): logo circular + nombre/marca + píldora de turno + campana de notificaciones.
- **Header B** (pantallas de detalle: Mesa X, Cobro, cualquier sheet): flecha atrás a la izquierda + título + acciones contextuales a la derecha (usando el patrón de "acción con ícono" del punto 1).

---

## Prompt para establecer esto antes de tocar cualquier pantalla

> Antes de rediseñar ninguna pantalla individual, necesito que estas 4 reglas queden como referencia común para todo el trabajo que sigue:
>
> 1. Dos patrones de ícono: "acción con ícono" (círculo/cuadrado con tinte de color + etiqueta debajo, para acciones contextuales como Compartir/Mover/Cobrar) y "chip de filtro" (píldora de solo texto, sin ícono, para categorías y filtros de estado) — nunca mezclados.
> 2. El semáforo de mesa usa exactamente los 6 colores/significados ya definidos en `lib/colorMesa.ts` (verde=libre, naranja=ocupada, azul=cobro parcial, rojo=sin atender, gris=fuera de servicio, morado=reservada) en cualquier pantalla que muestre estado de mesa — nunca una variación local. Los estados de ciclo de vida de un pedido (Cerrada/Abierta/Cancelada, en Historial) son un sistema visual distinto (píldora con ícono, no color sólido de tarjeta) para no confundirse con el semáforo.
> 3. Todo monto se muestra siempre con decimales (`$X,XXX.00`), sin excepción.
> 4. Header A (pantallas raíz del bottom nav) vs. Header B (pantallas de detalle) — cada una con su composición fija, documentada arriba.
>
> Agrega estas 4 reglas a `CLAUDE.md` como referencia persistente, y a `components/ui/tokens.ts` donde aplique (ej. un formateador de moneda compartido si no existe ya uno). Corre `npx tsc --noEmit` y confírmame que quedó documentado antes de que empecemos a rediseñar pantallas individuales.

---

Con esto ya aplicado, los 8 prompts de pantalla (Mesas, Menú, Sheet de producto, Cobro, Pedidos, Dashboard, Más, Historial) hacen referencia a estas reglas en vez de interpretar cada mockup por separado. ¿Armo los 8 ya, o empezamos con este primero y confirmamos que quedó bien antes de seguir?
