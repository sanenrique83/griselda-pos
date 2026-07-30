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

export type PuntoSilla = { x: number; y: number }

// Cuánto más grande que la mesa es el "anillo" donde se paran las sillas —
// en vez de calcular la normal saliente punto por punto (distinta en cada
// tramo recto vs. cada arco), se camina el mismo perímetro pero sobre una
// forma agrandada PAD px por lado. Agrandar un rectángulo redondeado en
// PAD px por lado (suma de Minkowski con un disco de radio PAD) sigue
// siendo un rectángulo redondeado válido, con w/h +2·PAD y radio +PAD — por
// eso el mismo caminador de perímetro sirve para el anillo sin cambios.
const PAD_SILLA_PX = 16

type SegmentoRecto = {
  tipo: 'linea'
  desde: PuntoSilla
  hasta: PuntoSilla
  longitud: number
}
type SegmentoArco = {
  tipo: 'arco'
  centro: PuntoSilla
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
        return {
          x: seg.desde.x + (seg.hasta.x - seg.desde.x) * t,
          y: seg.desde.y + (seg.hasta.y - seg.desde.y) * t,
        }
      }
      const anguloDeg = seg.anguloInicioDeg + (seg.anguloFinDeg - seg.anguloInicioDeg) * t
      const anguloRad = (anguloDeg * Math.PI) / 180
      return {
        x: seg.centro.x + seg.radio * Math.cos(anguloRad),
        y: seg.centro.y + seg.radio * Math.sin(anguloRad),
      }
    }
    acumulado += seg.longitud
  }
  // No debería llegar aquí (el bucle siempre retorna en el último segmento).
  return { x: 0, y: 0 }
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
      puntos.push({ x: radio * Math.sin(anguloRad), y: -radio * Math.cos(anguloRad) })
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
    puntos.push({ x: p.x - w / 2, y: p.y - h / 2 })
  }
  return puntos
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
