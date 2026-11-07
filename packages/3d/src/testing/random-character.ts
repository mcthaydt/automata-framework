// Random characters for the build tests: the library recombined, to prove any character file builds. Seeded, so a
// failure can be found again (no Math.random). From FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/cast.ts at
// a1f7246: `random` (mulberry32, as the source) and the generic half of `randomCharacter`: every slider drawn over its
// range (the lookbook's narrower ones), an outfit composed layer by layer from the garment registry with a wardrobe's
// draws (the caller's `wardrobe` draws, FigureBuilder's `WARDROBE`: an outer layer half the time over a top that goes
// under one), or, where no registered garment has a layer (core's set has none), a core outfit; a hair style with
// pieces, sometimes a cap, the face's marks. Not taken: the colourway and the sets (which skin goes with which lips,
// eyes and hair, the label's colours, one loud hue: SNEKPRTY's), the stands and the crew's own swatches. A swatch field
// draws from the library's swatches of a kind its role takes and in a role it takes, or, where the library has none,
// from those that name no kind or role.

import {
  DEFAULT_HEAD,
  DEFAULT_SLIDERS,
  type HeadShape,
  type Sliders,
} from '../features/figures/body/genes.ts'
import { at } from '../features/figures/body/rig.ts'
import type { FigureLibrary } from '../features/figures/figure/build.ts'
import type { FigureDef } from '../features/figures/figure/figure.schema.ts'
import type { Garment } from '../features/figures/figure/garment.schema.ts'
import '../features/figures/outfit/garments/classic-kinds.ts'
import {
  fieldRole,
  GARMENTS,
  type Layer,
  roleOf,
  TAKES,
} from '../features/figures/registry/garment-registry.ts'

/** A seeded random in [0, 1) (mulberry32): the same seed, the same cast. */
export function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A field's draw: a number over a range, or one of a few values. */
type Draw = readonly [number, number] | readonly (boolean | string)[]
/** How a random outfit draws a registry garment: its fields' draws, `under` an outer layer those instead (a
 * top with none is not worn under one), and an accessory's chance (half, without one). */
export interface Wear {
  readonly draw?: Readonly<Record<string, Draw>>
  readonly under?: Readonly<Record<string, Draw>>
  readonly chance?: number
}
/** The sliders a lookbook model keeps within (the rest run their whole range). */
const LOOKBOOK: Partial<Record<keyof Sliders, [number, number]>> = {
  posture: [0.45, 1],
  age: [0, 0.5],
  hunch: [0, 0.2],
  chunk: [0.4, 1],
  head: [0.45, 1],
  faceForward: [0.4, 0.85],
}
/** The gaits a random character walks in (FigureBuilder `STREET_GAITS`). */
export const STREET_GAITS = ['strut', 'loose', 'bounce', 'still', 'brisk'] as const
const SKINS = ['fair', 'pale', 'sallow', 'brown', 'auburn'] as const

export interface RandomCharacter {
  readonly def: FigureDef
  /** An item from the library half the time. */
  readonly item: string | null
}

export function randomCharacter(
  seed: number,
  library: FigureLibrary,
  /** A wardrobe's draws, by registry garment; core's set needs none. */
  wardrobe: Readonly<Record<string, Wear>> = {},
): RandomCharacter {
  const r = random(seed)
  const pick = <T>(a: readonly T[]): T => at(a, Math.floor(r() * a.length))
  const range = (lo: number, hi: number) => lo + (hi - lo) * r()
  const ids = Object.keys(library.swatches).sort()
  const plain = ids.filter(
    (id) => library.swatches[id]?.kind === undefined && library.swatches[id]?.role === undefined,
  )
  // A field's pool: the swatches of a kind its role takes, in a role it takes; else the plain ones.
  const poolOf = (key: string, field: string) => {
    const g = { [key]: '' } as unknown as Garment
    const kinds = roleOf(g, field) ?? []
    const role = fieldRole(g, field)
    const takes = role ? TAKES[role] : []
    const fit = ids.filter((id) => {
      const swatch = library.swatches[id]
      return (
        swatch?.kind !== undefined &&
        kinds.includes(swatch.kind) &&
        (swatch.role === undefined || takes.includes(swatch.role))
      )
    })
    return fit.length ? fit : plain
  }
  const draws = (key: string, under = false) => {
    const wear = wardrobe[key]
    const table = (under && wear?.under) || wear?.draw || {}
    return Object.fromEntries(
      Object.entries(table).map(([f, d]) => [
        f,
        typeof d[0] === 'number' ? range(d[0], d[1] as number) : pick(d as readonly unknown[]),
      ]),
    )
  }
  // A registry garment: its cloth always, its other swatch fields most of the time, then its draws.
  const wear = (key: string, under = false): Garment => {
    const out: Record<string, unknown> = {}
    const fields = Object.keys(GARMENTS[key]?.swatches ?? {})
    fields.forEach((f, i) => {
      if (i && r() >= 0.7) return
      out[f] = pick(poolOf(key, f))
    })
    Object.assign(out, draws(key, under))
    return out as unknown as Garment
  }
  const sliders: Partial<Sliders> = Object.fromEntries(
    Object.keys(DEFAULT_SLIDERS).map((key) => {
      const [lo, hi] = LOOKBOOK[key as keyof Sliders] ?? [0, 1]
      return [key, range(lo, hi)]
    }),
  )
  Object.assign(sliders, {
    height: range(150, 198),
    headTilt: range(-6, 6),
    face: Object.fromEntries(Object.keys(DEFAULT_HEAD).map((key) => [key, r()])) as Partial<HeadShape>,
  })
  // The outfit, layer by layer: an outer layer half the time over a top that goes under one.
  const keys = (layer: Layer) => Object.keys(GARMENTS).filter((key) => GARMENTS[key]?.layer === layer)
  const garments: Garment[] = []
  if (keys('top').length > 0) {
    const topKey = pick(keys('top'))
    const outerKey = wardrobe[topKey]?.under && r() < 0.5 ? pick(keys('outer')) : undefined
    garments.push(wear(topKey, !!outerKey))
    if (outerKey) garments.push(wear(outerKey))
    garments.push(wear(pick(keys('bottom'))), wear(pick(keys('shoes'))))
    for (const key of keys('accessory')) if (r() < (wardrobe[key]?.chance ?? 0.5)) garments.push(wear(key))
  } else {
    // No registered layers: core's garments, in plain colours.
    const colour = () => pick(plain)
    garments.push(
      { top: colour(), sleeves: pick(['none', 'short', 'long'] as const) },
      { trousers: colour() },
      { shoes: colour(), ...(r() < 0.4 ? { boots: true } : {}) },
    )
    if (r() < 0.3) garments.push({ cape: colour(), length: range(0.3, 1) })
  }
  // The head: a skin, a hair style in a plain colour, sometimes a cap (a mark on it half the
  // time).
  const skins = SKINS.filter((id) => library.swatches[id] !== undefined)
  const skin = skins.length ? pick(skins) : pick(plain)
  const styles = Object.keys(library.hair).sort()
  const caps = Object.keys(library.headwear)
    .sort()
    .filter((id) => library.headwear[id]?.cap)
  garments.push({ hair: pick(plain), style: pick(styles) })
  if (caps.length && r() < 0.3)
    garments.push({ cap: pick(plain), style: pick(caps), ...(r() < 0.5 ? { mark: pick(plain) } : {}) })
  garments.push({ eyes: library.swatches['eye-dark'] ? 'eye-dark' : pick(plain) })
  const items = Object.keys(library.items).sort()
  const item = items.length && r() < 0.5 ? pick(items) : null
  const def: FigureDef = {
    sliders,
    skin,
    gait: pick(STREET_GAITS),
    hand: 'R',
    outfits: { random: garments },
    default: 'random',
  }
  return { def, item }
}
