// A face keeps its skin hue in a dim or a cool room. The lit sprite moves each texel along its own DUEL row, and the skin's rows
// darken into mauve and purple (row 27: 554769, 765d73, 977488), and it tints toward the room's colour as well, so the painter's pink
// skin turned lavender in the ward. Here each skin texel the room changes is taken from the DUEL colour nearest its skin's own ramp (its
// swatch's painted tones, which redden as they darken) at the shade the room gives it, from no tint of the room's colour, never a
// grey-beige step of the same lightness; a texel it leaves as painted stays so.
import { type CharacterDef, type Material, paintedTones, RAMPS, SWATCHES } from '../../shared/figures/door.ts'

type Lab = readonly [number, number, number]

const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
/** A 0xRRGGBB colour in OKLab. */
function oklab(c: number): Lab {
  const [r, g, b] = [lin(((c >> 16) & 255) / 255), lin(((c >> 8) & 255) / 255), lin((c & 255) / 255)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Every DUEL colour a figure's shading uses (steps 1 to 7 of every row: step 0 is the painter's ink and holds), with its OKLab. */
const PALETTE: readonly { readonly rgb: number; readonly lab: Lab }[] = RAMPS.flatMap((row) =>
  row.slice(1).map((rgb) => ({ rgb, lab: oklab(rgb) })),
)

/** The swatch `name` names for `def`: its own, else the painter's library. */
const swatchOf = (def: CharacterDef, name: string): Material | undefined =>
  def.swatches?.[name] ?? SWATCHES[name]

/**
 * Every colour the painter paints a character's skin in, on DUEL: its skin swatch's four tones, its line (the outline's lit side) and its
 * fold (a line inside the figure), from the painter (`paintedTones`). The face stamp shades in the four tones. Left out, a line or fold is
 * lit as cloth and greys in a cool room.
 */
export function skinColours(def: CharacterDef): readonly number[] {
  const swatch = swatchOf(def, def.skin ?? '')
  return swatch === undefined ? [] : paintedTones(swatch, true)
}

/**
 * The skin's colours (`skinColours`) that another material the character names in its outfits paints too: Ada's skin fold #885041 is her
 * auburn hair's base tone, and the skin's deepest #a76057 the hair's shine. Held wherever it is painted, such a colour took the crown to
 * the skin's ramp; it is held only where the skin closes round it (`holdSkinHue`).
 */
export function sharedColours(def: CharacterDef): readonly number[] {
  const skin = new Set(skinColours(def))
  const others = new Set<number>()
  for (const pieces of Object.values(def.outfits ?? {}))
    for (const piece of pieces as readonly Record<string, unknown>[])
      for (const name of Object.values(piece)) {
        if (typeof name !== 'string' || name === def.skin) continue
        const swatch = swatchOf(def, name)
        if (swatch !== undefined) for (const c of paintedTones(swatch)) others.add(c)
      }
  return [...skin].filter((c) => others.has(c))
}

/**
 * The painter's colour budget merges a rare tone into a near colour of the figure, the whole tone at once (`budget` in the painter's
 * paint-budget.ts): Ada's deepest skin tone, on a few nostril and mouth-corner texels, came out as her boots' #945d4f, a colour of another
 * material that no list of her skin's colours can name. A stand-in is a colour the budget could have merged a skin tone into (`REACH` in
 * OKLab of one and `alike` it, the budget's own `MINOR[0]` and test) on a texel the held skin closes round (`RINGED` of its eight
 * neighbours): the same colour with no skin round it (the boots) is left to the room.
 */
const REACH = 0.075
const RINGED = 5
const deltaE = (p: Lab, q: Lab): number => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
/** The budget's `alike`: both near-grey, or of hues within 12 degrees and of like chroma. */
function alike(p: Lab, q: Lab): boolean {
  const [ca, cb] = [Math.hypot(p[1], p[2]), Math.hypot(q[1], q[2])]
  if (ca < 0.035 && cb < 0.035) return true
  const dh = Math.abs(Math.atan2(p[2], p[1]) - Math.atan2(q[2], q[1]))
  return Math.min(dh, 2 * Math.PI - dh) < 0.21 && Math.min(ca, cb) > 0.6 * Math.max(ca, cb)
}
const standIns = new WeakMap<ReadonlySet<number>, Map<number, boolean>>()
/** Whether the budget could have merged one of `skin`'s colours into `rgb`. */
function skinLike(rgb: number, skin: ReadonlySet<number>): boolean {
  let known = standIns.get(skin)
  if (!known) {
    known = new Map()
    standIns.set(skin, known)
  }
  let hit = known.get(rgb)
  if (hit === undefined) {
    const lab = oklab(rgb)
    hit = [...skin].some((c) => {
      const q = oklab(c)
      return deltaE(lab, q) < REACH && alike(lab, q)
    })
    known.set(rgb, hit)
  }
  return hit
}

/** How much a hue's arc weighs against the lightness: a step that matches the shade but not the colour loses to one that matches both. */
const HUE = 6

/**
 * The mean lightness between neighbouring steps of a DUEL row: the unit a skin's lost colour is counted in. A texel that misses the room's
 * light by a step still reads as the same skin a shade off; one that loses all its colour reads as grey cloth. So losing the whole of the
 * target's chroma costs one step of lightness, whatever the skin: a pale skin's faint colour is guarded as much as a deep skin's.
 */
const STEP = (() => {
  const gaps = RAMPS.flatMap((row) =>
    row.slice(2).map((rgb, i) => oklab(rgb)[0] - oklab(row[i + 1] as number)[0]),
  )
  return gaps.reduce((s, g) => s + g, 0) / gaps.length
})()

/** A skin's own ramp: its painted colours in OKLab, darkest first. */
type Ramp = readonly Lab[]
const ramps = new WeakMap<ReadonlySet<number>, { ramp: Ramp; darkened: Map<number, number> }>()
function rampOf(skin: ReadonlySet<number>) {
  let hit = ramps.get(skin)
  if (!hit) {
    hit = { ramp: [...skin].map(oklab).sort((p, q) => p[0] - q[0]), darkened: new Map() }
    ramps.set(skin, hit)
  }
  return hit
}

/**
 * The colour (a, b) a skin has at lightness `L` on its own ramp: between two of its painted tones, the mix of them; past its lightest or its
 * darkest, that tone's colour. Every swatch turns redder as it darkens (skinWarm 67 to 28 degrees of hue, skinGolden 81 to 30), as skin does
 * in shadow, so a highlight's yellow held at a shadow's lightness asks for a colour no skin has, and DUEL answers with an olive or a grey.
 */
function along(ramp: Ramp, L: number): readonly [number, number] {
  const first = ramp[0] as Lab
  if (L <= first[0]) return [first[1], first[2]]
  for (let i = 1; i < ramp.length; i++) {
    const [u, v] = [ramp[i - 1] as Lab, ramp[i] as Lab]
    if (L > v[0]) continue
    const t = v[0] > u[0] ? (L - u[0]) / (v[0] - u[0]) : 0
    return [u[1] + t * (v[1] - u[1]), u[2] + t * (v[2] - u[2])]
  }
  const last = ramp[ramp.length - 1] as Lab
  return [last[1], last[2]]
}

/**
 * The DUEL colour a skin texel takes when the room moves it to `lit`'s lightness: the nearest of every row's steps to the skin's own ramp at
 * that lightness, counting the lightness missed, the share of the ramp's chroma lost (in `STEP`s) and the hue's arc (weighed by `HUE`).
 */
function warmer(lit: number, skin: ReadonlySet<number>): number {
  const { ramp, darkened } = rampOf(skin)
  let hit = darkened.get(lit)
  if (hit !== undefined) return hit
  const L = oklab(lit)[0]
  const [a, b] = along(ramp, L)
  const [tC, tH] = [Math.hypot(a, b), Math.atan2(b, a)]
  let near = Number.POSITIVE_INFINITY
  hit = lit
  for (const p of PALETTE) {
    const dh = Math.abs(Math.atan2(p.lab[2], p.lab[1]) - tH)
    const arc = tC * Math.min(dh, 2 * Math.PI - dh)
    const lost = tC > 0 ? (Math.hypot(p.lab[1], p.lab[2]) - tC) / tC : 0
    const d = (p.lab[0] - L) ** 2 + (STEP * lost) ** 2 + HUE * arc ** 2
    if (d < near) {
      near = d
      hit = p.rgb
    }
  }
  darkened.set(lit, hit)
  return hit
}

const at = (px: Uint8ClampedArray, o: number): number =>
  ((px[o] ?? 0) << 16) | ((px[o + 1] ?? 0) << 8) | (px[o + 2] ?? 0)

/**
 * `lit` (the lit sprite's colours for `painted`) with each texel of a skin colour held to its hue: `neutral` is the same light with no
 * colour of its own, so the room's tint never reaches the skin, and a skin texel `neutral` changes takes the skin's own ramp at that lightness
 * (the painted colours of `skin`, light to dark, are that ramp). `width` is the cell's width in texels: with it, a stand-in the budget
 * put on the skin (`heldTexels`) is held as well; without it (0), only the texels of a `skin` colour. A colour in `shared` (`sharedColours`:
 * the skin's, and another material's too) is held, like a stand-in, only where the skin closes round it, and never without a `width`. Changes `lit` in place and returns it.
 */
export function holdSkinHue(
  painted: Uint8ClampedArray,
  neutral: Uint8ClampedArray,
  lit: Uint8ClampedArray,
  skin: ReadonlySet<number>,
  width = 0,
  shared: ReadonlySet<number> = NONE,
): Uint8ClampedArray {
  const held = heldTexels(painted, skin, width, shared)
  for (let k = 0; k < held.length; k++) {
    if (!held[k]) continue
    const o = k * 4
    const was = at(painted, o)
    const now = at(neutral, o)
    const out = now === was ? was : warmer(now, skin)
    lit[o] = (out >> 16) & 255
    lit[o + 1] = (out >> 8) & 255
    lit[o + 2] = out & 255
  }
  return lit
}

const NONE: ReadonlySet<number> = new Set()

/**
 * The texels of `painted` that are skin: every texel of a `skin` colour no other material shares, then each stand-in or shared colour the
 * held skin closes round, grown until none is added (one beside a held one counts it). With no `w` (0) a texel has no neighbours: only the
 * texels of an unshared `skin` colour are held.
 */
function heldTexels(
  painted: Uint8ClampedArray,
  skin: ReadonlySet<number>,
  w: number,
  shared: ReadonlySet<number>,
): Uint8Array {
  const n = painted.length / 4
  const held = new Uint8Array(n)
  const maybe: number[] = []
  for (let k = 0; k < n; k++) {
    if (!painted[k * 4 + 3]) continue
    const c = at(painted, k * 4)
    if (shared.has(c)) maybe.push(k)
    else if (skin.has(c)) held[k] = 1
    else if (skinLike(c, skin)) maybe.push(k)
  }
  if (w === 0) return held
  for (let grew = true; grew && maybe.length > 0; ) {
    grew = false
    for (let i = maybe.length - 1; i >= 0; i--) {
      const k = maybe[i] as number
      const [x, y] = [k % w, Math.floor(k / w)]
      let round = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const [xx, yy] = [x + dx, y + dy]
          if ((dx || dy) && xx >= 0 && xx < w && yy >= 0 && yy * w + xx < n && held[yy * w + xx]) round++
        }
      if (round >= RINGED) {
        held[k] = 1
        maybe.splice(i, 1)
        grew = true
      }
    }
  }
  return held
}
