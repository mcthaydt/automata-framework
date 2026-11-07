import { describe, expect, it } from 'vitest'
import { measure, type Sliders } from '#src/features/figures/body/genes.ts'
import type { Part } from '#src/features/figures/body/mesh.ts'
import { bodyOf, clearance, girth, profiles, ringAt } from '#src/features/figures/body/profiles.ts'
import { J, skeletonFromGenes } from '#src/features/figures/body/rig.ts'
import { FIGURE_PPM } from '#src/features/figures/body/texels.ts'
import { build } from '#src/features/figures/figure/build.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { type FixtureFigures, fixtureFigures } from '#src/testing/fixture-library.ts'
import { figureOf } from '#src/testing/golden-outfits.ts'
import { BASE_PAIR } from '../../../fixtures/base-pair.ts'

// FigureBuilder tests/features/outfit/fit.test.ts, rewritten to AF's outputs: the body as a query (`girth`, `clearance`,
// `bodyOf`) and the garments that size themselves from it (a cuff hugs the arm, the collar rides the neck).

const rig = (sliders: Partial<Sliders> = BASE_PAIR.man) => {
  const m = measure(sliders)
  const s = skeletonFromGenes(m.genes)
  return { m, s, p: profiles(m, s) }
}

describe('the body as a query (body/profiles.ts)', () => {
  it('girth is the box round the body over its span: every ring inside it, and each side touched', () => {
    const { p, s } = rig()
    const elbow = s.rest[J['foreArm.L']]?.[1] ?? 0
    const hi = elbow + 0.05
    const lo = elbow - 0.05
    const g = girth(p, 'arm', 'L', hi, lo)
    let xHi = Number.NEGATIVE_INFINITY
    let xLo = Number.POSITIVE_INFINITY
    let zHi = Number.NEGATIVE_INFINITY
    let zLo = Number.POSITIVE_INFINITY
    for (let i = 0; i <= 25; i++) {
      const r = ringAt(p, 'arm', 'L', lo + ((hi - lo) * i) / 25)
      const dx = r.dx ?? 0
      const dz = r.dz ?? 0
      expect(dx + r.rx).toBeLessThanOrEqual((g.dx ?? 0) + g.rx + 1e-9)
      expect(dx - r.rx).toBeGreaterThanOrEqual((g.dx ?? 0) - g.rx - 1e-9)
      expect(dz + r.rz).toBeLessThanOrEqual((g.dz ?? 0) + g.rz + 1e-9)
      expect(dz - r.rz).toBeGreaterThanOrEqual((g.dz ?? 0) - g.rz - 1e-9)
      xHi = Math.max(xHi, dx + r.rx)
      xLo = Math.min(xLo, dx - r.rx)
      zHi = Math.max(zHi, dz + r.rz)
      zLo = Math.min(zLo, dz - r.rz)
    }
    expect((g.dx ?? 0) + g.rx).toBeCloseTo(xHi, 3)
    expect((g.dx ?? 0) - g.rx).toBeCloseTo(xLo, 3)
    expect((g.dz ?? 0) + g.rz).toBeCloseTo(zHi, 3)
    expect((g.dz ?? 0) - g.rz).toBeCloseTo(zLo, 3)
  })
  it('the clearance is one texel at the figures density, never under 4 mm at the figures scale', () => {
    expect(clearance(1)).toBeCloseTo(1 / FIGURE_PPM, 12)
    expect(clearance(10)).toBeCloseTo(0.04, 12)
    expect(clearance(1, 1000)).toBeCloseTo(0.004, 12) // the 4 mm floor
  })
  it('bodyOf bundles the profiles, the ring at a height, the girth over a span and the clearance', () => {
    const { m, s, p } = rig()
    const body = bodyOf(m, s)
    expect(body.profiles).toEqual(p)
    expect(body.at('arm', 'L', 1.2)).toEqual(ringAt(p, 'arm', 'L', 1.2))
    expect(body.girth('leg', 'R', 0.1, 0.3)).toEqual(girth(p, 'leg', 'R', 0.1, 0.3))
    expect(body.clear).toBe(clearance(m.k))
  })
})

let fixture: FixtureFigures
const dressed = async (sliders: Partial<Sliders>, sleeves: 'long' | 'short', collar = false) => {
  fixture ??= await fixtureFigures()
  const def = figureOf(sliders, 'fair', [
    { top: 'navy', sleeves, cuffs: 'brass', ...(collar ? { collar: 'brass' } : {}) },
  ])
  const s = skeleton(def)
  const built = build(def, s, 'golden', null, fixture.library)
  return { m: measure(sliders), s, built }
}
const verts = (p: Part): number[][] => {
  const out: number[][] = []
  for (let i = 0; i < p.mesh.positions.length; i += 3)
    out.push([p.mesh.positions[i] ?? 0, p.mesh.positions[i + 1] ?? 0, p.mesh.positions[i + 2] ?? 0])
  return out
}
const named = (parts: readonly Part[], material: string) => parts.filter((p) => p.material === material)
const halfWidth = (p: Part): number => {
  const x = verts(p).map((q) => q[0] ?? 0)
  return (Math.max(...x) - Math.min(...x)) / 2
}

describe('garments sized from the body', () => {
  for (const [name, sliders] of Object.entries(BASE_PAIR))
    for (const sleeves of ['long', 'short'] as const)
      it(`${name} ${sleeves}: a cuff hugs the arm, its half-width the girth over its span plus one texel`, async () => {
        const { m, s, built } = await dressed(sliders, sleeves)
        const p = profiles(m, skeletonFromGenes(m.genes))
        const cuffs = named(built.parts, 'brass')
        expect(cuffs).toHaveLength(2)
        for (const [i, side] of (['L', 'R'] as const).entries()) {
          const bone = sleeves === 'long' ? J[`foreArm.${side}`] : J[`upperArm.${side}`]
          const rest = s.rest[bone]?.[1] ?? 0
          const y = rest - (sleeves === 'long' ? 0.9 * s.foreArm : 0.86 * s.upperArm)
          const hh = (sleeves === 'long' ? 0.022 : 0.02) * m.k
          const g = girth(p, 'arm', side, y + hh, y - hh)
          const cuff = cuffs[i]
          if (!cuff) throw new Error('no cuff')
          expect(halfWidth(cuff)).toBeCloseTo(g.rx + clearance(m.k), 9)
        }
      })
  it('a cuff hugs the arm at every slider end', async () => {
    for (const fat of [0, 1.2])
      for (const muscle of [0, 1])
        for (const frame of [0, 1]) {
          const sliders = { ...BASE_PAIR.man, fat, muscle, frame }
          const { m, s, built } = await dressed(sliders, 'long')
          const cuff = named(built.parts, 'brass')[0]
          if (!cuff) throw new Error('no cuff')
          const y = (s.rest[J['foreArm.L']]?.[1] ?? 0) - 0.9 * s.foreArm
          const span = girth(profiles(m, s), 'arm', 'L', y + 0.022 * m.k, y - 0.022 * m.k)
          expect(halfWidth(cuff) - span.rx).toBeCloseTo(clearance(m.k), 9)
        }
  })
  it('fat grows the cuff', async () => {
    const width = async (fat: number) => {
      const { built } = await dressed({ ...BASE_PAIR.man, fat }, 'short')
      const cuff = named(built.parts, 'brass')[0]
      if (!cuff) throw new Error('no cuff')
      return halfWidth(cuff)
    }
    expect(await width(1.2)).toBeGreaterThan(await width(0))
  })
  it('the collar rides the neck, not the bust, and a thick neck pushes it out', async () => {
    const collarAt = async (over: Partial<Sliders>) => {
      const { built } = await dressed({ ...BASE_PAIR.woman, ...over }, 'long', true)
      return named(built.parts, 'brass')
        .filter((p) => p.bone === J.chest)
        .flatMap(verts)
    }
    expect(await collarAt({ bust: 1 })).toEqual(await collarAt({ bust: 0 }))
    const front = (v: number[][]) => Math.max(...v.map((q) => q[2] ?? 0))
    expect(front(await collarAt({ neck: 1, fat: 1.2 }))).toBeGreaterThan(front(await collarAt({})))
  })
})
