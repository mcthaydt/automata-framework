import { describe, expect, it } from 'vitest'
import { GROUP, type Material } from '#src/shared/body/parts.ts'
import { J } from '#src/shared/body/rig.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member } from '#src/shared/figure/frames.ts'
import { box, type Garment, registerGarment } from '#src/shared/outfit/garments.ts'
import { fabricOf, registerFabric } from '#src/shared/paint/fabric.ts'
import { GLOSS_SHEEN, oklab, SHEEN_MAX, SHEEN_MIN, sheenScale } from '#src/shared/paint/paint.ts'
import { differs, dressed, turned } from '../../fixtures/draw'

/**
 * The painter's material features (paint.ts), restored as generic machinery that no base material sets: a holo and a
 * mirror lens, a see-through lens, a stain and its wash, and strands. Each is drawn on a plain probe cloth against the
 * same cloth without it: the frames must differ, and a second drawing must be the same. (The hair's sheen band has its
 * own test with the hair options.) Without these, a sweep for dead code would cut them again.
 */
const probe: Material = { ramp: 5, base: 3 }
const outfit: Garment[] = [{ top: 'probe', sleeves: 'long' }, { shorts: 'probe' }]
const draw = (swatch: Material) => turned(dressed(outfit, { probe: swatch }))

describe('a material feature changes the drawing, repeatably', () => {
  const plain = draw(probe)
  const features: [string, Material][] = [
    ['holo', { ...probe, holo: true }],
    ['a mirror', { ...probe, holo: 'mirror' }],
    // Stained from the knee down; on the legs (the shorts' thighs) it is the wash, on the torso's cloth the drips.
    [
      'a stain',
      { ...probe, stain: { paint: ['#d8c8a0', '#b8a070', '#887048', '#584828'], hem: 0.3, below: 0.9 } },
    ],
    ['strands', { ...probe, strands: true }],
  ]
  for (const [name, swatch] of features)
    it(name, () => {
      const drawn = draw(swatch)
      expect(differs(drawn, plain), 'differs').toBe(true)
      expect(differs(draw(swatch), drawn), 'repeatable').toBe(false)
    })
})

describe('a see-through lens shows the eyes under it', () => {
  // A lens over the eyes: a test-only kind with one wide slab standing off the head's front at the eyes' height (the
  // head's joint is at its foot, so the eyes are over half its height up), in the probe swatch.
  registerGarment('lens', {
    build: (c) => {
      const g = c.s.genes,
        h = g.head,
        hw = (h * g.headWidth) / 2,
        hd = (h * g.headDepth) / 2
      return {
        parts: [
          box(J.head, 'probe', GROUP.head, {
            at: [0, h * 0.55, hd * 1.2],
            r: [hw * 0.9, h * 0.08, hd * 0.15],
          }),
        ],
      }
    },
  })
  const face: Garment[] = [
    { eyes: 'eyeBrown', white: 'eyeWhite', brows: 'hairBlack', lips: 'lipsWarm' },
    { lens: 'x' } as unknown as Garment,
  ]
  it('differs from the same lens that does not', () => {
    const lens = (see?: boolean) => turned(dressed(face, { probe: { ...probe, see } }))
    expect(differs(lens(true), lens(false))).toBe(true)
    expect(differs(lens(true), lens(true))).toBe(false)
  })
})

describe('a dark gloss is leather', () => {
  // c5-finish: a dark glossy material (`gloss` set, its mid tone under L 0.4: leather, patent, a black frame) paints a dark
  // body with one soft highlight per surface where it mirrors the key, and no network of lines over every ring and bulge.
  const leather: Material = { ramp: 0, base: 1, gloss: 0.5 },
    matte: Material = { ramp: 0, base: 1 }
  /** The figure in `swatch` at density D, standing in direction d (or the walk's frame floor(n/4) at three-quarter back). */
  const fig = (
    swatch: Material,
    D: number,
    d: number,
    walk = false,
    extra: Garment[] = [],
    more: Record<string, Material> = {},
  ) => {
    const f = new Figure(member(dressed([...outfit, ...extra], { probe: swatch, ...more }), D))
    f.cache = false
    const input = {
      facing: (d * Math.PI) / 4,
      moving: walk,
      view: { azimuth: 0, pitch: (18 * Math.PI) / 180 },
    }
    if (!walk) for (let i = 0; i < 3; i++) f.update(1 / 60, input)
    else {
      const g = f['member'].gait,
        target = Math.floor(g.walkPoses / 4)
      let phase = 0
      for (let i = 0; i < Math.round(g.cycle * 4 * 60); i++) {
        phase = (phase + 1 / 60 / g.cycle) % 1
        f.update(1 / 60, input)
        if (i > g.cycle * 2 * 60 && Math.floor(phase * g.walkPoses) === target) break
      }
    }
    return f
  }
  const col = (f: Figure, k: number) =>
    (f.painted[k * 4] << 16) | (f.painted[k * 4 + 1] << 8) | f.painted[k * 4 + 2]
  /** The shine texels: those of the swatch's cloth in a colour the matte black's drawing never uses (the dark shine tone is
   * one the matte black's four colours and its rim lack; the budget's merges move other texels, so a diff would not do). */
  const shine = (f: Figure, m: Figure, name = 'probe') => {
    const mi = f['built'].materialIndex.get(name)!,
      out: number[] = [],
      seen = new Set<number>()
    for (let k = 0; k < m.g.w * m.g.h; k++) if (m.painted[k * 4 + 3]) seen.add(col(m, k))
    for (let k = 0; k < f.g.w * f.g.h; k++)
      if (f.g.material[k] === mi && f.painted[k * 4 + 3] && !seen.has(col(f, k))) out.push(k)
    return out
  }
  /** Four-connected areas of a set of texels. */
  const areas = (ks: number[], W: number) => {
    const left = new Set(ks),
      out: number[][] = []
    for (const k0 of ks) {
      if (!left.has(k0)) continue
      const a = [k0]
      left.delete(k0)
      for (let i = 0; i < a.length; i++)
        for (const q of [a[i] - 1, a[i] + 1, a[i] - W, a[i] + W]) if (left.delete(q)) a.push(q)
      out.push(a)
    }
    return out
  }
  const views: [number, number, boolean][] = [
    [0, 0, false],
    [1, 0, false],
    [4, 0, false],
    [3, 0, true],
  ]
  for (const D of [1, 2, 4])
    for (const [d, , walk] of views) {
      const label = `D${D} ${walk ? 'walk' : `direction ${d}`}`
      it(`${label}: differs from the matte black, and repeats`, () => {
        const g = fig(leather, D, d, walk),
          m = fig(matte, D, d, walk)
        expect(differs(g.painted, m.painted)).toBe(true)
        expect(differs(fig(leather, D, d, walk).painted, g.painted)).toBe(false)
      })
      it(`${label}: a soft highlight per surface, no line network`, () => {
        const g = fig(leather, D, d, walk),
          m = fig(matte, D, d, walk),
          W = g.g.w,
          ks = shine(g, m)
        expect(ks.length, 'some shine').toBeGreaterThan(0)
        const bySurface = new Map<number, number[]>()
        for (const k of ks) {
          const key = g.g.part[k] * 4096 + g.g.material[k]
          bySurface.set(key, [...(bySurface.get(key) ?? []), k])
        }
        for (const [key, list] of bySurface) {
          expect(list.length, `surface ${key}`).toBeLessThanOrEqual(
            Math.ceil(SHEEN_MAX * D * D * sheenScale(D)),
          )
          const as = areas(list, W)
          expect(as.length, `surface ${key}: areas`).toBeLessThanOrEqual(2)
          const has = (set: Set<number>, k: number, a: number, b: number) => set.has(k + a) || set.has(k + b)
          for (const area of as) {
            const set = new Set(area)
            // A streak has neighbours along one axis only; a patch has them on both.
            const both = area.filter((k) => has(set, k, -1, 1) && has(set, k, -W, W)).length
            if (area.length >= 6)
              expect(both / area.length, `surface ${key}: a line`).toBeGreaterThanOrEqual(0.5)
          }
        }
      })
      it(`${label}: the body stays dark`, () => {
        const dark = (f: Figure) => {
          const mi = f['built'].materialIndex.get('probe')!
          let n = 0,
            k0 = 0
          for (let k = 0; k < f.g.w * f.g.h; k++)
            if (f.g.material[k] === mi && f.painted[k * 4 + 3]) {
              n++
              if (oklab(col(f, k))[0] < 0.3) k0++
            }
          return k0 / n
        }
        expect(dark(fig(leather, D, d, walk))).toBeGreaterThanOrEqual(
          dark(fig(matte, D, d, walk)) - (GLOSS_SHEEN * 0.5 + 0.01),
        )
      })
    }
  it('the highlight is a highlight at every density: a third of the area at D4 that D2 has, and D2 keeps its look', () => {
    // The gate: at D4 the patch filled whole shoulder caps and the chest. The patch's share of its cloth scales with density.
    const share = (D: number, d: number) => {
      const g = fig(leather, D, d),
        m = fig(matte, D, d),
        mi = g['built'].materialIndex.get('probe')!
      let n = 0
      for (let k = 0; k < g.g.w * g.g.h; k++) if (g.g.material[k] === mi && g.painted[k * 4 + 3]) n++
      return shine(g, m).length / n
    }
    for (const d of [0, 1]) {
      const s2 = share(2, d),
        s4 = share(4, d)
      expect(s2, `D2 d${d}: keeps its look`).toBeGreaterThan(0.04)
      expect(s4, `D4 d${d}: ${s4} of ${s2}`).toBeLessThanOrEqual(s2 * 0.4)
      expect(s4, `D4 d${d}: still there`).toBeGreaterThan(0.005)
    }
  })
  it('a quilted dark gloss keeps its crest lines, short ones too (the orphan cleanup is for the patch)', () => {
    // Six baffles (a puffer's: a surface beside another of its group in the same ramp under another name), each one chamber
    // with a one-texel crest of shine along its top. A crest is a line, not an orphan highlight: the cleanup that drops a
    // short run of the sheen patch must leave it, though a crest is shorter than the patch's floor.
    registerGarment('lthquilt', {
      build: () => ({
        parts: [0, 1, 2, 3, 4, 5].map((i) =>
          box(J.chest, i % 2 ? 'qa' : 'qb', GROUP.torso, {
            at: [0, -0.12 + i * 0.045, 0.16],
            r: [0.07, 0.024, 0.06],
          }),
        ),
      }),
    })
    const quilt: Garment = { lthquilt: 'x' } as unknown as Garment
    for (const D of [2, 4]) {
      const swatches = (s: Material) => ({ pull: s, qa: s, qb: { ...s } })
      const g = fig(leather, D, 0, false, [quilt], swatches(leather)),
        m = fig(matte, D, 0, false, [quilt], swatches(matte))
      const ks = [...shine(g, m, 'qa'), ...shine(g, m, 'qb')],
        W = g.g.w,
        floor = Math.ceil((SHEEN_MIN * D * D * sheenScale(D)) / 4)
      expect(ks.length, `D${D}: the crests shine`).toBeGreaterThan(0)
      expect(
        areas(ks, W).filter((a) => a.length < floor).length,
        `D${D}: some crest is under the patch's floor of ${floor}`,
      ).toBeGreaterThan(0)
    }
  })
  it('a surface under 6·D² texels takes no shine (a zip pull, a black frame)', () => {
    registerGarment('lthpull', {
      build: (c) => ({
        parts: [box(J.chest, 'pull', GROUP.torso, { at: [0, 0.1, 0.2], r: [0.012, 0.012, 0.012] })],
      }),
    })
    const small: Garment = { lthpull: 'x' } as unknown as Garment
    for (const D of [2, 4]) {
      const g = fig(leather, D, 0, false, [small], { pull: leather }),
        m = fig(matte, D, 0, false, [small], { pull: matte })
      let n = 0
      for (let k = 0; k < g.g.w * g.g.h; k++)
        if (g.g.material[k] === g['built'].materialIndex.get('pull')! && g.painted[k * 4 + 3]) n++
      expect(n, `D${D}: the pull shows`).toBeGreaterThan(0)
      expect(n, `D${D}: and is small`).toBeLessThan(6 * D * D)
      expect(shine(g, m, 'pull'), `D${D}`).toEqual([])
    }
  })
  it('with a fabric on it, no shine texel is tiled, and the drawing repeats', () => {
    if (!fabricOf('fx-leather-twill'))
      registerFabric('fx-leather-twill', {
        w: 4,
        h: 4,
        labels: Array.from({ length: 16 }, (_, i) => (((i % 4) - Math.floor(i / 4) + 4) % 4 === 0 ? -1 : 0)),
      })
    const tiled: Material = { ...leather, fabric: 'fx-leather-twill' }
    for (const D of [2, 4])
      for (const d of [0, 4]) {
        // The shine's places do not depend on the tile (it goes on last), so they are the untiled leather's.
        const g = fig(tiled, D, d),
          ks = shine(fig(leather, D, d), fig(matte, D, d))
        expect(ks.length, `D${D} d${d}`).toBeGreaterThan(0)
        expect(g.weave, `D${D} d${d}: a weave`).not.toBeNull()
        for (const k of ks) expect(g.weave!.on[k], `D${D} d${d} texel ${k}`).toBe(0)
        expect(differs(fig(tiled, D, d).painted, g.painted)).toBe(false)
      }
  })
})
