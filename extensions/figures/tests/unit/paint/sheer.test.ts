import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { rampOf } from '#src/entries/kit.ts'
import { BASE } from '#src/shared/base/base-pair.ts'
import { measure } from '#src/shared/body/genes.ts'
import { GROUP, type Material } from '#src/shared/body/parts.ts'
import { skeleton } from '#src/shared/body/rig.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { TIMES } from '#src/shared/lighting/lamps.ts'
import { lightFigure } from '#src/shared/lighting/light.ts'
import { lightSprite } from '#src/shared/lighting/sprite.ts'
import { dress, registerGarment, SWATCHES, type Wearing } from '#src/shared/outfit/garments.ts'
import { RAMPS } from '#src/shared/paint/duel-ramps.ts'
import { oklab } from '#src/shared/paint/paint.ts'
import { dressed } from '../../fixtures/draw'
import { mixLegs, pinned, sheerTest } from '../../fixtures/pins'

/**
 * Sheer cloth (paint.ts, `Material.mix.edge`): hosiery over a leg is denser at its rim, where the cloth is seen along its
 * stretch, than where it faces the eye. Drawn on base-f's legs in a test material (tests/fixtures/pins.ts), against the
 * same material with no `edge`, which is the pinned cell of before c9 (`mixPlain`).
 */
const md5 = (b: Uint8ClampedArray) => createHash('md5').update(b).digest('hex')
const DUEL = new Set(RAMPS.flat())
/** Whether every opaque texel of an RGBA buffer is a DUEL colour. */
const allDuel = (px: Uint8ClampedArray) => {
  for (let i = 0; i < px.length; i += 4)
    if (px[i + 3] && !DUEL.has((px[i] << 16) | (px[i + 1] << 8) | px[i + 2])) return false
  return true
}

declare module '../../../src/shared/outfit/garments' {
  interface GarmentKinds {
    fxSkin: { fxSkin: true }
  }
}
/** What a kind is told of the wearer's skin (`Wearing.skin`), by the name of the swatch it got, per figure. */
const seen: string[] = []
registerGarment('fxSkin', {
  build: (c: Wearing) => {
    seen.push(c.skin)
    return { parts: [] }
  },
})

describe("a sheer material's edge", () => {
  it('with no edge, or 0, is the cell the material drew before c9 (the pin)', () => {
    expect(md5(mixLegs())).toBe(pinned('mixPlain'))
    expect(md5(mixLegs(0))).toBe(pinned('mixPlain'))
  })
  it('with an edge draws only DUEL colours, the same twice, and differs from none', () => {
    const a = mixLegs(0.6)
    expect(allDuel(a)).toBe(true)
    expect(md5(mixLegs(0.6))).toBe(md5(a))
    expect(md5(a)).not.toBe(pinned('mixPlain'))
  })

  /** Base-f's front view at density 2, with the legs sheer at `edge`: per row of the shin, the lightness of the leg's outermost texel on each side and of its middle texels. */
  function rows(edge?: number) {
    const def = BASE[1].def,
      [w] = member(def, 2).cell
    const dressedDef = dressed(
      [...def.outfits.base, { fxPaint: { thigh: 'sheerTest', knee: 'sheerTest', shin: 'sheerTest' } }],
      { sheerTest: sheerTest(0.5, edge) },
      def,
    )
    const fig = new Figure(member(dressedDef, 2))
    for (let i = 0; i < 3; i++) fig.update(1 / 60, { facing: 0, moving: false, view: view() })
    const g = fig.g,
      L = (k: number) =>
        oklab((fig.painted[k * 4] << 16) | (fig.painted[k * 4 + 1] << 8) | fig.painted[k * 4 + 2])[0]
    const out: { rim: number; mid: number }[] = []
    // The left leg's texels per row; the shin is its lower half (the rows 45–80% of the way down the leg's extent).
    const ys: number[] = []
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < w; x++)
        if (g.group[y * w + x] === GROUP.legL) {
          ys.push(y)
          break
        }
    const top = ys[0],
      span = ys[ys.length - 1] - top
    for (const y of ys.filter((v) => v >= top + 0.45 * span && v <= top + 0.8 * span)) {
      const xs: number[] = []
      for (let x = 0; x < w; x++) if (g.group[y * w + x] === GROUP.legL) xs.push(x)
      if (xs.length < 5) continue
      const mid = xs
          .slice(Math.floor(xs.length / 2) - 1, Math.floor(xs.length / 2) + 1)
          .map((x) => L(y * w + x)),
        rim = [xs[0], xs[xs.length - 1]].map((x) => L(y * w + x))
      out.push({ rim: (rim[0] + rim[1]) / 2, mid: (mid[0] + mid[1]) / 2 })
    }
    return out
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  it('is denser (darker, the cloth being dark) at the rim of the shin than in its middle, and leaves the middle as it was', () => {
    const edged = rows(0.6),
      plain = rows(0)
    expect(edged.length).toBeGreaterThan(5)
    expect(mean(edged.map((r) => r.rim)), 'the rim is darker than the middle').toBeLessThan(
      mean(edged.map((r) => r.mid)),
    )
    expect(mean(edged.map((r) => r.rim)), 'and darker than with no edge').toBeLessThan(
      mean(plain.map((r) => r.rim)),
    )
    expect(mean(edged.map((r) => r.mid)), 'the middle is as it was').toBeCloseTo(
      mean(plain.map((r) => r.mid)),
      6,
    )
  })

  it("lit with a lamp and as a sprite, the edge cell is all DUEL (the lighting finds a texel's ramp by its colour)", () => {
    const def = BASE[1].def,
      dd = dressed(
        [...def.outfits.base, { fxPaint: { thigh: 'sheerTest', knee: 'sheerTest', shin: 'sheerTest' } }],
        { sheerTest: sheerTest(0.5, 0.6) },
        def,
      )
    const fig = new Figure(member(dd, 2))
    fig.cache = false
    for (let i = 0; i < 3; i++) fig.update(1 / 60, { facing: 0, moving: false, view: view() })
    const lamp = lightFigure(fig, {
      time: TIMES.night,
      lamps: [
        { at: [0, 3.2, 0.6], color: '#fff3d6', steps: 3, radius: 4, tint: 0.35, aim: [0, -1, 0], cone: 26 },
      ],
      t: 0,
      bounce: { floor: 0x5b5c69 },
    })
    expect(allDuel(lamp)).toBe(true)
    const sprite = lightSprite(fig, { flat: [1, 1, 1], lamps: [{ dir: [-0.6, 0.3, 0.74], strength: 1 }] })
    expect(allDuel(sprite)).toBe(true)
  })

  it("rampOf is a swatch's paint ramp as it is, else its four DUEL tones as hex", () => {
    const painted: Material = { ramp: 0, base: 3, paint: ['#aabbcc', '#8899aa', '#667788', '#445566'] }
    expect(rampOf(painted)).toEqual(painted.paint)
    const plain = rampOf(SWATCHES.flatGrey)
    expect(plain).toHaveLength(4)
    for (const h of plain) {
      expect(h).toMatch(/^#[0-9a-f]{6}$/)
      expect(DUEL.has(parseInt(h.slice(1), 16))).toBe(true)
    }
  })

  it("a registered kind is told the wearer's skin swatch (Wearing.skin)", () => {
    seen.length = 0
    for (const b of BASE) {
      const m = measure(b.def.sliders)
      dress(m, skeleton(m.genes), b.def.skin, [{ fxSkin: true }])
    }
    expect(seen).toEqual(BASE.map((b) => b.def.skin))
  })
})
