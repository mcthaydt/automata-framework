// The `lamps` check (ED3D.2b-2): a lamp of a known kind keeps to its archetype's colour tone and range band, as Last Light's
// `lampIssues` (src/render/look.ts, 92e6704) says it. The archetypes and the tone are the game's, read by the host and
// handed in; the sentences for colour and range are the game's own, and the game's other sentence ("not from the kit")
// is its style gate and not this check's, so a lamp with no kind is not looked at. A kind the list lacks is said in the
// editor's words, where the game's sentence names a function the editor does not have.
import type { BlockoutLamp } from '../../format/blockout.schema'
import { entitySelection, type Problem, place } from '../check'

/** One lamp archetype: its colour in sRGB 0 to 1, and the band of ranges in metres a lamp of the kind may have. */
export interface LampKind {
  readonly color: readonly [number, number, number]
  readonly range: readonly [number, number]
}

/** Last Light's `TONE`, the distance in OKLab a lamp's colour may be from its archetype's, when the game gives none. */
export const DEFAULT_TONE = 0.06

type Vector = [number, number, number]

/** sRGB 0 to 1 to OKLab, the formula of the game's `oklab` (src/render/look.ts). */
export function oklab([r, g, b]: readonly number[]): Vector {
  const linear = (channel = 0): number =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)] as Vector
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** How far apart two sRGB colours are in OKLab. */
export function colourDistance(a: readonly number[], b: readonly number[]): number {
  const [p, q] = [oklab(a), oklab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/**
 * In file order, each lamp's colour sentence and then its range sentence. Only a lamp that names a kind is checked: a
 * kind the list has is held to the archetype, a kind it lacks (an inherited member name is a kind it lacks) is said once.
 */
export function lampProblems(
  lamps: readonly BlockoutLamp[],
  kinds: Readonly<Record<string, LampKind>>,
  tone: number,
): Problem[] {
  const problems: Problem[] = []
  for (const lamp of lamps) {
    if (lamp.kind === undefined) continue
    const locator = place(() => entitySelection('lamp', lamp.id), { x: lamp.x, z: lamp.z })
    const say = (message: string): number => problems.push({ message, locator })
    const archetype = Object.hasOwn(kinds, lamp.kind) ? kinds[lamp.kind] : undefined
    if (archetype === undefined) {
      say(`lamp ${lamp.id}: kind ${lamp.kind} is not one of ${Object.keys(kinds).join(', ')}`)
      continue
    }
    const off = colourDistance(lamp.color, archetype.color)
    if (off > tone)
      say(
        `lamp ${lamp.id} (${lamp.kind}): colour is ${off.toFixed(3)} from the archetype's, over ${tone} (OKLab)`,
      )
    const [low, high] = archetype.range
    if (lamp.range < low || lamp.range > high)
      say(`lamp ${lamp.id} (${lamp.kind}): range ${lamp.range} m outside ${low}–${high} m`)
  }
  return problems
}
