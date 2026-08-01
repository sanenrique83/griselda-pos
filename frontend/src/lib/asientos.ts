import { dimensionesMesa } from '@/components/mesas/MesaShape'
import type { FormaMesa, TamanoMesa } from '@/lib/types/database.types'

// ─────────────────────────────────────────────────────────────────────────────
// Geometría de sillas alrededor de una mesa.
//
// Todo se calcula en coordenadas LOCALES, relativas al centro de la mesa,
// SIN aplicar `rotacion` — el llamador debe renderizar los marcadores como
// hijos del mismo contenedor que ya tiene `transform: rotate(rotacion deg)`
// (igual que MesaShape), así que la rotación de la mesa arrastra los
// marcadores automáticamente vía CSS. Esto es literalmente "silla 1 en un
// punto fijo... antes de aplicar rotación": aquí nunca se ve `rotacion`.
//
// Punto de referencia de la silla 1: el punto medio del borde SUPERIOR de la
// mesa (arriba, centrada), para las 3 formas. Es el mismo criterio para las
// 3 —no un caso especial por forma— porque así "silla 1 arriba" significa
// lo mismo sin importar cómo esté configurada la mesa.
//
// A partir de ahí, el resto de las sillas se reparten a distancia arco-
// longitud IGUAL entre sí alrededor del perímetro real de la forma:
//   - Círculo: perímetro circular exacto — ángulo uniforme = arco uniforme,
//     no hace falta parametrizar nada más.
//   - Cuadrado/rectángulo: MesaShape los dibuja con esquinas redondeadas
//     (radius=10, ver dimensionesMesa). Para que las sillas queden "físicas"
//     (la mayoría pegadas a los lados rectos, un par curveando en las
//     esquinas — no flotando en una elipse que corta las esquinas), se
//     camina el perímetro real de ese rectángulo redondeado: 4 tramos
//     rectos + 4 arcos de 90°, empezando en el punto medio del tramo recto
//     superior y a distancia de arco constante = perímetro/capacidad.
// ─────────────────────────────────────────────────────────────────────────────

// `anguloDeg` es el ángulo (convención atan2(y,x), en grados — 0°=derecha,
// 90°=abajo, igual que un CSS `rotate()`) hacia donde "mira" la silla en ese
// punto, es decir, la normal saliente del perímetro de la mesa ahí. Sirve
// para rotar el marcador de silla (medio círculo, ver MesaShape) de forma
// que el lado curvo (asiento) quede hacia afuera y el lado recto (respaldo)
// hacia el centro de la mesa.
export type PuntoSilla = { x: number; y: number; anguloDeg: number }

// Cuánto más grande que la mesa es el "anillo" donde se paran las sillas —
// en vez de calcular la normal saliente punto por punto (distinta en cada
// tramo recto vs. cada arco), se camina el mismo perímetro pero sobre una
// forma agrandada PAD px por lado. Agrandar un rectángulo redondeado en
// PAD px por lado (suma de Minkowski con un disco de radio PAD) sigue
// siendo un rectángulo redondeado válido, con w/h +2·PAD y radio +PAD — por
// eso el mismo caminador de perímetro sirve para el anillo sin cambios.
//
// El marcador de silla (MesaShape) se centra exactamente en este anillo, y
// su lado recto —el respaldo— pasa por su propio centro (no está desplazado
// hacia adentro), así que PAD es literalmente la distancia entre el borde
// real de la mesa y el respaldo de la silla. Se mantiene chico (no 0) para
// que no se vea encimado con el trazo del borde de la mesa, pero lo
// suficientemente chico para que la silla se vea "pegada" a la mesa en vez
// de flotando — el tamaño visual de la silla (36px, mismo diámetro que los
// círculos del picker de silla, ver MesaShape) lo pone el propio marcador,
// no este valor.
const PAD_SILLA_PX = 6

// Punto 2D simple, sin `anguloDeg` — geometría interna del caminador de
// perímetro (desde/hasta/centro de cada tramo), distinta de `PuntoSilla`
// (la salida pública, que sí lleva el ángulo de la silla en ese punto).
type Punto2D = { x: number; y: number }

type SegmentoRecto = {
  tipo: 'linea'
  desde: Punto2D
  hasta: Punto2D
  longitud: number
}
type SegmentoArco = {
  tipo: 'arco'
  centro: Punto2D
  anguloInicioDeg: number
  anguloFinDeg: number
  radio: number
  longitud: number
}
type Segmento = SegmentoRecto | SegmentoArco

// Construye el perímetro de un rectángulo con esquinas redondeadas, en
// coordenadas de esquina superior-izquierda (0,0)–(w,h), como una lista de
// tramos recorridos EN SENTIDO HORARIO empezando en el punto medio del
// borde superior. Convención de ángulo: con y creciendo hacia abajo (como
// en pantalla), el punto center + radio·(cos θ, sin θ) avanza en sentido
// horario según θ crece — por eso los 4 arcos van 270→360, 0→90, 90→180,
// 180→270 en ese orden (top-right, bottom-right, bottom-left, top-left).
function segmentosRectanguloRedondeado(w: number, h: number, r: number): Segmento[] {
  const rr = Math.min(r, w / 2, h / 2) // defensivo: nunca más grande que la mitad del lado
  const centroTL = { x: rr, y: rr }
  const centroTR = { x: w - rr, y: rr }
  const centroBR = { x: w - rr, y: h - rr }
  const centroBL = { x: rr, y: h - rr }
  const arcoLen = (Math.PI * rr) / 2

  return [
    // 1. Mitad derecha del borde superior: centro → esquina sup-derecha
    { tipo: 'linea', desde: { x: w / 2, y: 0 }, hasta: { x: w - rr, y: 0 }, longitud: w / 2 - rr },
    // 2. Arco superior-derecho
    { tipo: 'arco', centro: centroTR, anguloInicioDeg: -90, anguloFinDeg: 0, radio: rr, longitud: arcoLen },
    // 3. Lado derecho
    { tipo: 'linea', desde: { x: w, y: rr }, hasta: { x: w, y: h - rr }, longitud: h - 2 * rr },
    // 4. Arco inferior-derecho
    { tipo: 'arco', centro: centroBR, anguloInicioDeg: 0, anguloFinDeg: 90, radio: rr, longitud: arcoLen },
    // 5. Borde inferior completo
    { tipo: 'linea', desde: { x: w - rr, y: h }, hasta: { x: rr, y: h }, longitud: w - 2 * rr },
    // 6. Arco inferior-izquierdo
    { tipo: 'arco', centro: centroBL, anguloInicioDeg: 90, anguloFinDeg: 180, radio: rr, longitud: arcoLen },
    // 7. Lado izquierdo
    { tipo: 'linea', desde: { x: 0, y: h - rr }, hasta: { x: 0, y: rr }, longitud: h - 2 * rr },
    // 8. Arco superior-izquierdo
    { tipo: 'arco', centro: centroTL, anguloInicioDeg: 180, anguloFinDeg: 270, radio: rr, longitud: arcoLen },
    // 9. Mitad izquierda del borde superior: esquina sup-izquierda → centro
    { tipo: 'linea', desde: { x: rr, y: 0 }, hasta: { x: w / 2, y: 0 }, longitud: w / 2 - rr },
  ]
}

function puntoADistancia(segmentos: Segmento[], distancia: number): PuntoSilla {
  let acumulado = 0
  for (const seg of segmentos) {
    const esUltimo = seg === segmentos[segmentos.length - 1]
    if (distancia <= acumulado + seg.longitud || esUltimo) {
      const local = Math.max(0, distancia - acumulado)
      const t = seg.longitud === 0 ? 0 : Math.min(1, local / seg.longitud)
      if (seg.tipo === 'linea') {
        const x = seg.desde.x + (seg.hasta.x - seg.desde.x) * t
        const y = seg.desde.y + (seg.hasta.y - seg.desde.y) * t
        // Normal saliente de un tramo recto = su tangente rotada -90°
        // ((dx,dy) → (dy,-dx)) — el caminador de segmentosRectanguloRedondeado
        // siempre avanza en sentido HORARIO, así que esa rotación fija
        // siempre apunta hacia AFUERA del rectángulo en los 4 lados (probado
        // para el lado superior y el lado derecho; los otros dos son iguales
        // por la simetría de la construcción).
        const dx = seg.hasta.x - seg.desde.x
        const dy = seg.hasta.y - seg.desde.y
        const anguloDeg = (Math.atan2(-dx, dy) * 180) / Math.PI
        return { x, y, anguloDeg }
      }
      const anguloArcoDeg = seg.anguloInicioDeg + (seg.anguloFinDeg - seg.anguloInicioDeg) * t
      const anguloRad = (anguloArcoDeg * Math.PI) / 180
      // Normal saliente de un arco = su propia dirección radial (mismo
      // ángulo con el que se parametrizó el punto sobre el círculo del arco).
      return {
        x: seg.centro.x + seg.radio * Math.cos(anguloRad),
        y: seg.centro.y + seg.radio * Math.sin(anguloRad),
        anguloDeg: anguloArcoDeg,
      }
    }
    acumulado += seg.longitud
  }
  // No debería llegar aquí (el bucle siempre retorna en el último segmento).
  return { x: 0, y: 0, anguloDeg: 0 }
}

/**
 * Posiciones de `numSillas` sillas alrededor de una mesa, en coordenadas
 * LOCALES relativas al centro de la mesa (x: + = derecha, y: + = abajo),
 * SIN rotación aplicada — ver nota de arriba.
 *
 * Silla 1 (índice 0) siempre queda arriba, al centro. El resto se reparte a
 * distancia de arco uniforme sobre el perímetro real de la forma (círculo
 * exacto; rectángulo/cuadrado con esquinas redondeadas caminando sus 4
 * lados + 4 arcos), en sentido horario si `horario` es true, antihorario
 * si es false — la dirección solo decide hacia dónde va la silla 2, 3...,
 * la 1 no se mueve.
 */
export function calcularPosicionesSillas(
  numSillas: number,
  forma: FormaMesa,
  tamano: TamanoMesa,
  horario: boolean,
): PuntoSilla[] {
  if (numSillas <= 0) return []

  const { width, height } = dimensionesMesa(forma, tamano)

  if (forma === 'circulo') {
    const radio = width / 2 + PAD_SILLA_PX
    const puntos: PuntoSilla[] = []
    for (let k = 0; k < numSillas; k++) {
      const anguloDeg = (horario ? 1 : -1) * ((360 * k) / numSillas)
      const anguloRad = (anguloDeg * Math.PI) / 180
      const x = radio * Math.sin(anguloRad)
      const y = -radio * Math.cos(anguloRad)
      // En un círculo la normal saliente es siempre radial: mismo ángulo
      // que el propio punto visto desde el centro.
      puntos.push({ x, y, anguloDeg: (Math.atan2(y, x) * 180) / Math.PI })
    }
    return puntos
  }

  // cuadrado / rectangulo: mismo caminador de perímetro, agrandado PAD_SILLA_PX
  // por lado (ver comentario de PAD_SILLA_PX — sigue siendo un rectángulo
  // redondeado válido, solo con w/h/radio más grandes).
  const w = width + 2 * PAD_SILLA_PX
  const h = height + 2 * PAD_SILLA_PX
  const r = 10 + PAD_SILLA_PX // mismo radio de esquina que MesaShape (10px), agrandado igual
  const segmentos = segmentosRectanguloRedondeado(w, h, r)
  const perimetro = segmentos.reduce((s, seg) => s + seg.longitud, 0)
  const paso = perimetro / numSillas

  const puntos: PuntoSilla[] = []
  for (let k = 0; k < numSillas; k++) {
    const distanciaCruda = horario ? k * paso : perimetro - k * paso
    const distancia = ((distanciaCruda % perimetro) + perimetro) % perimetro
    const p = puntoADistancia(segmentos, distancia)
    puntos.push({ x: p.x - w / 2, y: p.y - h / 2, anguloDeg: p.anguloDeg })
  }
  return puntos
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometría de sillas para una CADENA de mesas unidas (varias mesas físicas
// tratadas como una sola mesa larga para efectos de sentar comensales).
//
// A diferencia de `calcularPosicionesSillas` (perímetro de UNA mesa, forma
// real con esquinas redondeadas), aquí se asume siempre un rectángulo de
// lados RECTOS sin esquinas redondeadas — "varias mesas pegadas en fila" no
// se ve como una mesa individual con radio de esquina, se ve como una mesa
// larga recta. Tampoco se pide `forma`/`tamano` por mesa: se asume el mismo
// tamaño en toda la cadena (ver instrucción del ticket), así que el ancho de
// referencia de "una mesa individual" se toma de dimensionesMesa('rectangulo',
// 'medio') — un valor fijo, no el tamaño real configurado de cada mesa física
// (que puede variar mesa por mesa incluso dentro de la misma cadena; ese caso
// mixto queda fuera de alcance por ahora, tal como se pidió).
//
// Silla 1 = centro del extremo corto IZQUIERDO (la "cabecera 1"). A partir de
// ahí se numera: cabecera 1 → lado largo de ARRIBA (izquierda a derecha) →
// cabecera 2 (extremo corto derecho) → lado largo de ABAJO (derecha a
// izquierda) → cierra el anillo de vuelta a cabecera 1. Incluye la mitad de
// las sillas de cada costado repartidas uniformemente por longitud de arco
// (nunca en las esquinas exactas, para que se vean "sobre el lado recto").
//
// Redondeo si (total - 2 cabeceras) es impar: el costado que se camina
// PRIMERO (el de arriba, justo después de la cabecera 1) recibe el asiento
// extra — mismo principio de "un solo sentido consistente" que ya usa
// `calcularPosicionesSillas` para no tener que decidir caso por caso.
// ─────────────────────────────────────────────────────────────────────────────

export type PuntoSillaCadena = PuntoSilla & {
  // Índice (0-based) de la mesa física, dentro del arreglo `mesas` recibido,
  // a la que pertenece geométricamente este asiento — la cabecera 1 siempre
  // es de la mesa 0, la cabecera 2 siempre es de la última mesa, y cada
  // asiento de costado se atribuye a la mesa sobre cuyo tramo de ancho cae
  // (mismo ancho de referencia para todas, ver nota de arriba).
  mesaIndice: number
}

const REF_MESA_CADENA = { forma: 'rectangulo' as const, tamano: 'medio' as const }

export function calcularPosicionesSillasCadena(
  mesas: { capacidad: number }[],
): PuntoSillaCadena[] {
  if (mesas.length === 0) return []

  const { width: anchoIndividual, height: alto } = dimensionesMesa(
    REF_MESA_CADENA.forma,
    REF_MESA_CADENA.tamano,
  )
  const anchoTotal = anchoIndividual * mesas.length
  const total = mesas.reduce((s, m) => s + Math.max(m.capacidad, 0), 0)

  if (total <= 0) return []

  const mesaIndicePorX = (x: number): number =>
    Math.min(mesas.length - 1, Math.max(0, Math.floor(x / anchoIndividual)))

  if (total === 1) {
    // Cabecera 1 sola: mira hacia afuera del extremo izquierdo (180°).
    return [{ x: -anchoTotal / 2, y: 0, anguloDeg: 180, mesaIndice: 0 }]
  }

  const resto = total - 2
  const ladoArribaCount = Math.ceil(resto / 2)
  const ladoAbajoCount = Math.floor(resto / 2)

  const puntos: PuntoSillaCadena[] = []

  // Cabecera 1: extremo corto izquierdo, siempre de la primera mesa. Mira
  // hacia afuera (izquierda, 180°) — el rectángulo de la cadena es de lados
  // rectos, así que a diferencia de una mesa individual el ángulo no varía
  // punto a punto dentro de cada tramo, es fijo por sección.
  puntos.push({ x: -anchoTotal / 2, y: 0, anguloDeg: 180, mesaIndice: 0 })

  // Lado de arriba, izquierda → derecha. Mira hacia arriba (-90°).
  for (let i = 0; i < ladoArribaCount; i++) {
    const x = (anchoTotal * (i + 0.5)) / ladoArribaCount
    puntos.push({ x: x - anchoTotal / 2, y: -alto / 2, anguloDeg: -90, mesaIndice: mesaIndicePorX(x) })
  }

  // Cabecera 2: extremo corto derecho, siempre de la última mesa. Mira hacia
  // afuera (derecha, 0°).
  puntos.push({ x: anchoTotal / 2, y: 0, anguloDeg: 0, mesaIndice: mesas.length - 1 })

  // Lado de abajo, derecha → izquierda (cierra el anillo en sentido
  // consistente). Mira hacia abajo (90°).
  for (let i = 0; i < ladoAbajoCount; i++) {
    const x = anchoTotal * (1 - (i + 0.5) / ladoAbajoCount)
    puntos.push({ x: x - anchoTotal / 2, y: alto / 2, anguloDeg: 90, mesaIndice: mesaIndicePorX(x) })
  }

  return puntos
}

/**
 * Cuenta cuántos asientos aparecen ocupados en CADA mesa física, a partir de
 * los pedidos abiertos y sus subpedidos con silla asignada — usado para los
 * marcadores siempre-visibles de MesaShape en /mesas y /mas/mapa-mesas.
 *
 * Si el pedido de una mesa no tiene mesas satélite, la cuenta es directa
 * (cuántas sillas de esa mesa aparecen en sillasOcupadasPorPedido). Si tiene
 * cadena, se reparte usando `calcularPosicionesSillasCadena` para saber a
 * cuál mesa física pertenece cada número de silla — mismo criterio que usa
 * el diagrama de asignación de comensal, para no inventar una atribución
 * distinta aquí.
 */
export function calcularOcupacionPorMesa(params: {
  pedidos: { id: number; mesaId: number }[]
  pedidoMesas: { pedidoId: number; mesaId: number; orden: number }[]
  capacidadPorMesa: Map<number, number>
  sillasOcupadasPorPedido: Map<number, number[]>
}): Map<number, number> {
  const { pedidos, pedidoMesas, capacidadPorMesa, sillasOcupadasPorPedido } = params
  const resultado = new Map<number, number>()

  for (const pedido of pedidos) {
    const satelites = pedidoMesas
      .filter((pm) => pm.pedidoId === pedido.id)
      .sort((a, b) => a.orden - b.orden)
    const cadenaMesaIds = [pedido.mesaId, ...satelites.map((s) => s.mesaId)]
    const sillasOcupadas = sillasOcupadasPorPedido.get(pedido.id) ?? []

    if (cadenaMesaIds.length === 1) {
      resultado.set(pedido.mesaId, sillasOcupadas.length)
      continue
    }

    const mesasCadena = cadenaMesaIds.map((mid) => ({ capacidad: capacidadPorMesa.get(mid) ?? 1 }))
    const puntos = calcularPosicionesSillasCadena(mesasCadena)
    const conteoPorIndice = new Map<number, number>()
    for (const sillaNum of sillasOcupadas) {
      const punto = puntos[sillaNum - 1]
      if (!punto) continue // silla fuera de rango (sobre-ocupación) — no rompe el conteo visual
      conteoPorIndice.set(punto.mesaIndice, (conteoPorIndice.get(punto.mesaIndice) ?? 0) + 1)
    }
    cadenaMesaIds.forEach((mid, idx) => {
      resultado.set(mid, conteoPorIndice.get(idx) ?? 0)
    })
  }

  return resultado
}

/**
 * Siguiente silla libre en secuencia (1, 2, 3…) dada la lista de números de
 * silla ya ocupados del pedido — usada al agregar un comensal nuevo para
 * asignarle silla automáticamente, sin picker ni confirmación. Ignora
 * `capacidad`: si la mesa ya está sobre-ocupada, sigue contando hacia
 * arriba en vez de bloquear la asignación.
 */
export function siguienteSillaLibre(sillasOcupadas: (number | null)[]): number {
  const ocupadas = new Set(sillasOcupadas.filter((n): n is number => n !== null))
  let n = 1
  while (ocupadas.has(n)) n++
  return n
}
