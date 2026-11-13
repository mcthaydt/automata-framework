// A face keeps its skin hue under a dim or a cool room's light, and only gets darker (`holdSkinHue`, lit-cells.ts). The DUEL skin row
// (27) darkens into mauve and purple (554769, 765d73, 977488), and the lit sprite tints toward the room's colour, so a dim cool room
// turned the painter's pink skin lavender: a skin texel's hue moved by 25 degrees or more where a warm row's steps hold it.
import { describe, expect, it } from 'vitest'
import { FASHION_SWATCHES } from '#src/features/fashion/swatches.ts'
import { litCells } from '#src/features/painted/lit-cells.ts'
import { Painter } from '#src/features/painted/painter.ts'
import { roomLight, type Tint } from '#src/features/painted/room-light.ts'
import { holdSkinHue, sharedColours, skinColours, skinRamp } from '#src/features/painted/skin-hue.ts'
import {
  BASE,
  type CharacterDef,
  Figure,
  type Material,
  member,
  RAMPS,
  SPRITE_PITCH,
  SWATCHES,
  type V3,
} from '#src/shared/figures/door.ts'

const FEET: V3 = [0, 0, 0]
const base = (BASE.find((b) => b.def.id === 'base-f') as { def: CharacterDef }).def
/** The base woman in the old game's fair skin: the quad on DUEL rows 27, 27, 19 and 24, which is what Ada is painted in. */
const fair: CharacterDef = {
  ...base,
  skin: 'fair',
  swatches: {
    ...base.swatches,
    fair: {
      ramp: 27,
      base: 5,
      lift: 0,
      paint: ['#ebbd9d', '#d5a39a', '#c17e7a', '#945d4f'],
      tones: [0.05, -0.55, -0.9],
    },
  },
}
const standing = (density: 1 | 2 | 4 = 2) => {
  const figure = new Figure(member(fair, density))
  for (let i = 0; i < 3; i++)
    figure.update(1 / 60, { facing: 0, moving: false, view: { azimuth: 0, pitch: SPRITE_PITCH } })
  return figure
}
/** The ward's kind of light: dim and a little cool. */
const cool: Tint = () => [0.6, 0.74, 0.84]
const dimmer: Tint = () => [0.45, 0.56, 0.66]

const SKIN = new Set(['ebbd9d', 'd5a39a', 'c17e7a', '945d4f'])
const hex = (px: ArrayLike<number>, o: number) =>
  (((px[o] as number) << 16) | ((px[o + 1] as number) << 8) | (px[o + 2] as number))
    .toString(16)
    .padStart(6, '0')

/** sRGB (0 to 255 each) to OKLab, for the hue angle and lightness. */
function oklab(c: string): [number, number, number] {
  const lin = (i: number) => {
    const v = Number.parseInt(c.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [lin(0), lin(2), lin(4)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const hueOf = (c: string) => {
  const [, a, b] = oklab(c)
  return (Math.atan2(b, a) * 180) / Math.PI
}
const apart = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180)

/** Every skin texel of the figure lit by `tint`: its painted colour and its lit one, where the two differ. */
function skinUnder(tint: Tint, hold: boolean, density: 1 | 2 | 4 = 2) {
  const figure = standing(density)
  const lit = litCells(undefined, hold ? { held: [{ colours: skinColours(fair) }] } : undefined).lit(
    figure,
    roomLight(tint, undefined, FEET, 0),
  )
  const out: { was: string; now: string }[] = []
  for (let o = 0; o < lit.painted.length; o += 4) {
    if (!lit.painted[o + 3]) continue
    const was = hex(lit.painted, o)
    if (SKIN.has(was)) out.push({ was, now: hex(lit.rgba, o) })
  }
  return out
}

describe('a face in a dim cool room', () => {
  it('turns lavender without the option: the skin the room darkens moves 25 degrees or more of hue', () => {
    const moved = skinUnder(cool, false).filter((t) => apart(hueOf(t.was), hueOf(t.now)) >= 25)
    expect(moved.length).toBeGreaterThan(0)
  })

  // A texel may take its swatch's own darker tone (the highlight #ebbd9d at 56 degrees darkens to #d5a39a at 30, as the painter's own
  // shading does), so the bound is the swatch's hue span (five degrees either side), not the texel's own hue: the lavender it once
  // took (row 27's 977488 at -16 degrees, 765d73 below) lies well outside it, toward purple.
  it('keeps its skin hue with it: no skin texel leaves the hues its swatch paints, at three densities and two lights', () => {
    const hues = [...SKIN].map(hueOf)
    const [lo, hi] = [Math.min(...hues) - 5, Math.max(...hues) + 5]
    for (const density of [1, 2, 4] as const)
      for (const tint of [cool, dimmer]) {
        const skin = skinUnder(tint, true, density)
        expect(skin.length).toBeGreaterThan(50)
        for (const t of skin) {
          expect(hueOf(t.now)).toBeGreaterThanOrEqual(lo)
          expect(hueOf(t.now)).toBeLessThanOrEqual(hi)
        }
      }
  })

  it('only gets darker: the skin is darker on the whole than it was painted, and no texel is more than a step lighter', () => {
    const skin = skinUnder(cool, true)
    const mean = (pick: (t: { was: string; now: string }) => string) =>
      skin.reduce((s, t) => s + oklab(pick(t))[0], 0) / skin.length
    expect(mean((t) => t.now)).toBeLessThan(mean((t) => t.was))
    for (const t of skin) expect(oklab(t.now)[0]).toBeLessThan(oklab(t.was)[0] * 1.2)
  })

  it('is darker in a dimmer room: the mean lightness of the skin falls with the light', () => {
    const mean = (tint: Tint) => {
      const skin = skinUnder(tint, true)
      return skin.reduce((s, t) => s + oklab(t.now)[0], 0) / skin.length
    }
    expect(mean(dimmer)).toBeLessThan(mean(cool))
  })
})

describe('the painter, with the option', () => {
  const frame = (light: ReturnType<typeof roomLight>) => ({
    t: 0,
    dt: 1 / 60,
    facing: 0,
    state: { moving: false },
    view: { azimuth: 0, pitch: SPRITE_PITCH },
    light,
  })
  it('lights the skin by hue: the same figure and light are different bytes with it, and the default is the lit sprite’s own', () => {
    const light = roomLight(cool, undefined, FEET, 0)
    const plain = new Painter(fair, 2).paint(frame(light)).rgba
    const held = new Painter(fair, 2, { holdSkinHue: true }).paint(frame(light)).rgba
    const again = new Painter(fair, 2, { holdSkinHue: false }).paint(frame(light)).rgba
    expect(Buffer.compare(Buffer.from(plain), Buffer.from(held))).not.toBe(0)
    expect(Buffer.compare(Buffer.from(plain), Buffer.from(again))).toBe(0)
  })
})

// A lit skin tone a step or three darker must stay skin. Each swatch's paint is its own ramp, light to dark, and every one turns redder
// as it darkens (skinWarm 67 to 28 degrees of OKLab hue, skinGolden 81 to 30); a texel the room darkens must land on that ramp, not on
// a grey-beige DUEL step of the same lightness. The old metric held the texel's own hue at the darker lightness with a chroma in
// proportion to it, weighed chroma at a quarter, and took the grey: Ada's nose highlight #edb67c a step down played #c0a588, her skin
// #ce9770 two steps down #857565 (the grey nose and forehead in play).
describe('every skin swatch the kit ships, a lit tone dimmed by one, two and three steps', () => {
  const skins = Object.entries({ ...SWATCHES, ...FASHION_SWATCHES }).filter(([name]) =>
    name.startsWith('skin'),
  )
  const lch = (c: string) => {
    const [L, a, b] = oklab(c)
    return { L, C: Math.hypot(a, b), h: hueOf(c) }
  }
  /** A one-texel sprite. */
  const texel = (c: number) => new Uint8ClampedArray([c >> 16, (c >> 8) & 255, c & 255, 255])
  /** What the held skin plays when the room moves a texel painted `was` down its own DUEL row to `dim`. */
  const held = (was: number, dim: number, skin: ReadonlySet<number>) => {
    const out = holdSkinHue(texel(was), texel(dim), texel(dim), skin)
    return hex(out, 0)
  }
  /** Each painted tone with the DUEL steps one, two and three below it on its own row (step 0 is the painter's ink). */
  const dimmed = (paint: readonly number[]) =>
    paint.flatMap((was) => {
      const row = RAMPS.find((r) => r.includes(was)) as readonly number[]
      const i = row.indexOf(was)
      return [1, 2, 3].filter((k) => i - k >= 1).map((k) => ({ was, k, dim: row[i - k] as number }))
    })

  it('ships the six skins, light to deep', () => {
    expect(skins.map(([name]) => name).sort()).toEqual(
      ['skinBrown', 'skinDeep', 'skinGolden', 'skinPale', 'skinTan', 'skinWarm'].sort(),
    )
  })

  it('stays on the swatch’s own warm ramp: its hue within the swatch’s span (15 degrees either side), its chroma at least .6 of the painted', () => {
    const off: string[] = []
    for (const [name, swatch] of skins) {
      const paint = (swatch.paint ?? []).map((c) => Number.parseInt(c.slice(1), 16))
      const hues = paint.map((c) => lch(c.toString(16).padStart(6, '0')).h)
      const [lo, hi] = [Math.min(...hues) - 15, Math.max(...hues) + 15]
      for (const { was, k, dim } of dimmed(paint)) {
        const from = was.toString(16).padStart(6, '0')
        const now = held(was, dim, new Set(paint))
        const [p, q] = [lch(from), lch(now)]
        if (q.h < lo || q.h > hi || q.C < 0.6 * p.C) off.push(`${name} #${from} -${k}: #${now}`)
      }
    }
    expect(off).toEqual([])
  })

  it('takes Ada’s nose highlight and her skin a step down to warm skin, not the grey-beige steps', () => {
    const warm = new Set(
      ['#edb67c', '#ce9770', '#bd7d64', '#a76057'].map((c) => Number.parseInt(c.slice(1), 16)),
    )
    expect(held(0xedb67c, 0xce9770, warm)).not.toBe('c0a588')
    expect(held(0xce9770, 0xa76057, warm)).not.toBe('857565')
    expect(lch(held(0xedb67c, 0xce9770, warm)).C).toBeGreaterThan(0.6 * lch('edb67c').C)
  })
})

// What the painter puts on skin is more than the swatch's four painted tones: the skin's own line (the selective outline's lit side) and
// its fold (a line inside the figure, the jaw over the neck), both derived from the swatch, and the face stamp's shades. Each must be in
// the held set, or the room greys it (Ada's nostrils and mouth corners played #685f59). The skin texels are found from the painter, not
// listed: the same figure painted in a probe skin (a blue no kit skin is near) shows its skin in the probe's own hue, and the face's
// marks (whites, brows, lips) and the clothes in their own colours, so every texel the probe paints blue is skin; of those, a texel that
// is the same colour under a far kit skin (pale for the rest, deep for pale) is the figure's shared dark (ink, its near-blacks), not skin.
describe('every colour the painter puts on skin, for each skin swatch the kit ships', () => {
  const PROBE = { ramp: 7, base: 4, paint: ['#3d8ff0', '#2a6ad0', '#1e4aa0', '#123070'] }
  const probeHue = hueOf('2a6ad0')
  const all = { ...SWATCHES, ...FASHION_SWATCHES }
  const skins = Object.entries(all).filter(([name]) => name.startsWith('skin'))
  const DIRECTIONS = [0, 1, 2]
  const dressed = (swatch: Material): CharacterDef => ({
    ...base,
    skin: 'skinUnderTest',
    swatches: { ...base.swatches, skinUnderTest: swatch },
  })
  const painted = new Map<string, Uint8ClampedArray>()
  /** The painted cell of the base woman in `name`'s skin (or the probe's), facing `direction`; painted once. */
  const cell = (name: string, direction: number) => {
    const key = `${name}|${direction}`
    let hit = painted.get(key)
    if (!hit) {
      const swatch = name === 'probe' ? PROBE : all[name]
      const figure = new Figure(member(dressed(swatch as Material), 2))
      for (let i = 0; i < 3; i++)
        figure.update(1 / 60, {
          facing: (direction * Math.PI) / 4,
          moving: false,
          view: { azimuth: 0, pitch: SPRITE_PITCH },
        })
      hit = figure.painted.slice()
      painted.set(key, hit)
    }
    return hit
  }
  /** The colours on the figure's skin texels in its own skin, front, three-quarter and profile. */
  const onSkin = (name: string) => {
    const found = new Set<string>()
    for (const direction of DIRECTIONS) {
      const own = cell(name, direction)
      const probe = cell('probe', direction)
      const far = cell(name === 'skinPale' ? 'skinDeep' : 'skinPale', direction)
      for (let o = 0; o < own.length; o += 4) {
        if (!own[o + 3] || !probe[o + 3] || hex(own, o) === hex(far, o)) continue
        const p = hex(probe, o)
        const [, a, b] = oklab(p)
        if (Math.hypot(a, b) > 0.05 && apart(hueOf(p), probeHue) < 30) found.add(hex(own, o))
      }
    }
    return found
  }
  const held = (def: CharacterDef) => new Set(skinColours(def).map((c) => c.toString(16).padStart(6, '0')))

  it('holds them all: the paint, the skin’s line and fold, and the face stamp’s shades', () => {
    const missing: string[] = []
    for (const [name, swatch] of skins) {
      const set = held(dressed(swatch))
      for (const c of onSkin(name)) if (!set.has(c)) missing.push(`${name} #${c}`)
    }
    expect(missing).toEqual([])
  })

  it('keeps each of them in its swatch’s hue span (15 degrees either side) dimmed one, two and three steps down its own row', () => {
    const off: string[] = []
    for (const [name, swatch] of skins) {
      const def = dressed(swatch)
      const set = new Set(skinColours(def))
      const hues = (swatch.paint ?? []).map((c) => hueOf(c.slice(1)))
      const [lo, hi] = [Math.min(...hues) - 15, Math.max(...hues) + 15]
      for (const c of set) {
        const row = RAMPS.find((r) => r.includes(c)) as readonly number[]
        const i = row.indexOf(c)
        for (const k of [1, 2, 3].filter((s) => i - s >= 1)) {
          const dim = row[i - k] as number
          const px = (v: number) => new Uint8ClampedArray([v >> 16, (v >> 8) & 255, v & 255, 255])
          const now = hex(holdSkinHue(px(c), px(dim), px(dim), set), 0)
          if (hueOf(now) < lo || hueOf(now) > hi) off.push(`${name} #${c.toString(16)} -${k}: #${now}`)
        }
      }
    }
    expect(off).toEqual([])
  })
})

// The painter's colour budget merges a rare tone into a near colour of the figure, wholesale: on Ada the face stamp's two-step shade
// (#a76057, her swatch's deepest, on a few nostril and mouth-corner texels) became her boots' #945d4f, a colour of another material,
// so no list of her skin's colours can name it. A texel of a skin-like colour (within the budget's reach of a skin tone, of its hue)
// that the skin closes round is that stand-in, and is held; the same colour on the boots, with no skin round it, is the boots'.
describe('the budget’s stand-in for a skin tone', () => {
  const SKIN_TONES = [0xedb67c, 0xce9770, 0xbd7d64, 0xa76057]
  const S = 0xce9770
  const N = 0x945d4f
  const L = 0x7c4b47
  const J = 0x25466b
  /** A 5 by 5 cell, row by row: skin round a nostril pair, the upper lip below in jeans, a boot of the stand-in's colour under them. */
  const rows = [
    [S, S, S, S, S],
    [S, N, N, S, S],
    [S, S, S, S, S],
    [J, L, L, J, J],
    [J, N, N, N, J],
  ]
  const cellOf = (pick: (c: number) => number) =>
    new Uint8ClampedArray(rows.flat().flatMap((c) => [...rgb(pick(c)), 255]))
  const rgb = (c: number) => [c >> 16, (c >> 8) & 255, c & 255]
  // The room dims each colour two steps down its own DUEL row.
  const down = (c: number) => {
    const row = RAMPS.find((r) => r.includes(c)) as readonly number[]
    return row[Math.max(1, row.indexOf(c) - 2)] as number
  }
  const at = (px: Uint8ClampedArray, x: number, y: number) => hex(px, (y * 5 + x) * 4)

  it('holds the nostrils the skin closes round, and leaves the lip and the boot to the room', () => {
    const painted = cellOf((c) => c)
    const dimmed = cellOf(down)
    const lit = holdSkinHue(painted, dimmed.slice(), dimmed.slice(), new Set(SKIN_TONES), 5)
    const hues = SKIN_TONES.map((c) => hueOf(c.toString(16)))
    for (const x of [1, 2]) {
      expect(at(lit, x, 1)).not.toBe(at(dimmed, x, 1))
      expect(hueOf(at(lit, x, 1))).toBeGreaterThanOrEqual(Math.min(...hues) - 15)
    }
    expect(at(lit, 1, 3)).toBe(at(dimmed, 1, 3))
    for (const x of [1, 2, 3]) expect(at(lit, x, 4)).toBe(at(dimmed, x, 4))
  })
})

// A skin colour another of the figure's materials paints too: Ada's skin fold #885041 is her auburn hair's base tone, and her skin's
// deepest #a76057 the hair's shine. Held by colour, the crown took the skin's line, an orange; so a shared colour is held only where the
// skin closes round it, as the budget's stand-in is.
describe('a colour the skin shares with another material', () => {
  const auburn = {
    ramp: 2,
    base: 2,
    gloss: 0.94,
    strands: true,
    paint: ['#885041', '#662b29', '#49251c', '#372423'],
  }
  const def: CharacterDef = {
    ...base,
    skin: 'skinWarm',
    swatches: { ...base.swatches, auburn },
    outfits: { ...base.outfits, plain: [{ hair: 'auburn', style: 'bobOpen' }] },
    default: 'plain',
  }

  it('is named: the warm skin’s fold is the auburn hair’s base tone, and the skin’s own paint shared with nothing is not', () => {
    const shared = sharedColours(def)
    expect(shared).toContain(0x885041)
    expect(shared).not.toContain(0xce9770)
  })

  it('is left to the room in the hair and held where the skin closes round it', () => {
    const [S, F, H] = [0xce9770, 0x885041, 0x49251c]
    const rows = [
      [H, H, H, H, H],
      [H, F, H, F, S],
      [S, S, S, S, S],
      [S, S, F, S, S],
      [S, S, S, S, S],
    ]
    const rgba = (pick: (c: number) => number) =>
      new Uint8ClampedArray(
        rows.flat().flatMap((c) => [pick(c) >> 16, (pick(c) >> 8) & 255, pick(c) & 255, 255]),
      )
    const dim = (c: number) => {
      const row = RAMPS.find((r) => r.includes(c)) as readonly number[]
      return row[Math.max(1, row.indexOf(c) - 2)] as number
    }
    const painted = rgba((c) => c)
    const dimmed = rgba(dim)
    const lit = holdSkinHue(
      painted,
      dimmed.slice(),
      dimmed.slice(),
      new Set(skinColours(def)),
      5,
      new Set(sharedColours(def)),
    )
    const at = (px: Uint8ClampedArray, x: number, y: number) => hex(px, (y * 5 + x) * 4)
    expect(at(lit, 1, 1)).toBe(at(dimmed, 1, 1))
    expect(at(lit, 3, 1)).toBe(at(dimmed, 3, 1))
    expect(at(lit, 2, 3)).not.toBe(at(dimmed, 2, 3))
  })
})

// The line and fold the painter derives are held, but a held texel takes its swatch's own painted ramp: the warm skin's line #753b09 is an
// orange, and held along a ramp that ended in it, her deepest tone and fold darkened to it and Ada's jaw edge played orange specks.
describe('a held texel takes its swatch’s own ramp, not the derived tones', () => {
  const px = (v: number) => new Uint8ClampedArray([v >> 16, (v >> 8) & 255, v & 255, 255])
  const warm: CharacterDef = { ...base, skin: 'skinWarm' }
  const lch = (c: string) => {
    const [L, a, b] = oklab(c)
    return { L, C: Math.hypot(a, b) }
  }
  it('names the ramp as the swatch’s four painted tones', () => {
    expect(skinRamp(warm)).toEqual([0xedb67c, 0xce9770, 0xbd7d64, 0xa76057])
  })
  it('darkens the deepest tone and the fold to red-browns, never to the line’s orange (which a ramp of every held colour gives)', () => {
    const held = (was: number, dim: number, ramp: readonly number[]) =>
      hex(holdSkinHue(px(was), px(dim), px(dim), new Set(skinColours(warm)), 0, undefined, new Set(ramp)), 0)
    for (const [was, dim] of [
      [0xa76057, 0x6e2434],
      [0x885041, 0x733d3b],
    ] as const) {
      expect(held(was, dim, skinColours(warm))).toBe('753b09')
      expect(held(was, dim, skinRamp(warm))).not.toBe('753b09')
      expect(lch(held(was, dim, skinRamp(warm))).C).toBeLessThan(lch('753b09').C)
    }
  })
})
