// The mood grade, as the source look has it: a mood moves every colour in OKLab (its lightness scaled, a and b shifted, a
// pull of a and b toward a colour, its chroma scaled) before the DUEL snap, so the frame comes back onto the palette
// through the same snap as any other. A scene names its mood (a level's `look.grade`); a script may mix two over time
// (`mixMoods`). The pass (grade-effect.ts) repeats `gradeColour` on the GPU.

import { oklab } from '../../shared/math/colour.ts'

/** A mood: a lightness scale, a shift in OKLab a and b, a pull toward a colour (L, a, b, how far), a chroma scale. */
export interface Mood {
  readonly L: number
  readonly a: number
  readonly b: number
  readonly pull?: readonly [number, number, number, number] | undefined
  readonly chroma: number
}

/** The built-in moods. Add your own with `registerMood`, not by writing here. */
export const MOODS: Readonly<Record<string, Mood>> = Object.freeze({
  warmNight: { L: 1.0, a: 0.005, b: 0.014, chroma: 1.03 },
  coldDawn: { L: 1.03, a: -0.01, b: -0.035, chroma: 0.9 },
  sodium: { L: 1.0, a: 0.01, b: 0.025, pull: [0, 0.05, 0.1, 0.12], chroma: 0.92 },
})

/** The mood that changes nothing. */
export const IDENTITY: Mood = Object.freeze({ L: 1, a: 0, b: 0, chroma: 1 })

const registered = new Map<string, Mood>()

/** Registers a mood by name, beside the built-in ones; a name already taken is replaced in the registry, never in the built-ins. */
export function registerMood(name: string, mood: Mood): void {
  registered.set(name, { ...mood })
}

/** A mood by name: registered first, then the built-ins. */
export const moodOf = (name: string): Mood | undefined => registered.get(name) ?? MOODS[name]

/** Two moods mixed (`u` 0 is `a`, 1 is `b`), for a grade that changes over time; none is the identity mood. */
export function mixMoods(a: Mood | undefined, b: Mood | undefined, u: number): Mood {
  const p = a ?? IDENTITY
  const q = b ?? IDENTITY
  const l = (x: number, y: number): number => x + (y - x) * u
  const pp = p.pull ?? [0, q.pull?.[1] ?? 0, q.pull?.[2] ?? 0, 0]
  const qp = q.pull ?? [0, p.pull?.[1] ?? 0, p.pull?.[2] ?? 0, 0]
  return {
    L: l(p.L, q.L),
    a: l(p.a, q.a),
    b: l(p.b, q.b),
    chroma: l(p.chroma, q.chroma),
    ...(p.pull || q.pull ? { pull: [0, l(pp[1], qp[1]), l(pp[2], qp[2]), l(pp[3], qp[3])] as const } : {}),
  }
}

const toSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

/** OKLab `[L, a, b]` as `0xRRGGBB` (clamped to the gamut). */
export function rgbFromLab(L: number, a: number, b: number): number {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.reduce(
    (out, c) => (out << 8) | Math.round(Math.min(1, Math.max(0, toSrgb(Math.min(1, Math.max(0, c))))) * 255),
    0,
  )
}

/** A colour (`0xRRGGBB`) under a mood: chroma, then lightness and the a and b shift, then the pull. */
export function gradeColour(colour: number, mood: Mood): number {
  let [L, a, b] = oklab(colour)
  a *= mood.chroma
  b *= mood.chroma
  L *= mood.L
  a += mood.a
  b += mood.b
  if (mood.pull !== undefined) {
    const [, pa, pb, amount] = mood.pull
    a += (pa - a) * amount
    b += (pb - b) * amount
  }
  return rgbFromLab(L, a, b)
}
