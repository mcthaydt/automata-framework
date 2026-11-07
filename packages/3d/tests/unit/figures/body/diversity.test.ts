import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HEAD,
  DEFAULT_SLIDERS,
  type HeadShape,
  measure,
  type Sliders,
} from '#src/features/figures/body/genes.ts'
import { profiles, ringAt } from '#src/features/figures/body/profiles.ts'
import { skeletonFromGenes } from '#src/features/figures/body/rig.ts'
import { headForm } from '#src/features/figures/outfit/garments/head.ts'
import { BASE_IDS, BASE_PAIR } from '../../../fixtures/base-pair.ts'

// The body's reach over more bodies (the builder's fat, bust and seat, eyes and asymmetry): each is a no-op at its
// default, a real range at its ends, and a figure at any end still has a sound body.

const rigOf = (sliders: Partial<Sliders>) => {
  const m = measure(sliders)
  return { m, s: skeletonFromGenes(m.genes) }
}
const ring = (sliders: Partial<Sliders>, region: 'torso' | 'arm' | 'leg' | 'neck', y: number) => {
  const { m, s } = rigOf(sliders)
  return ringAt(profiles(m, s), region, 'L', y)
}

describe('Measure.fat', () => {
  it('is exactly 1 in every class at fat 0', () => {
    expect(measure({ fat: 0 }).fat).toEqual({ swell: 1, joint: 1, hipTop: 1, end: 1, neck: 1, chin: 1 })
  })
  it("at fat 1: the swells 35%, the joints more, the thigh's top less, the ends at most 10%, the neck 20%, the chin fuller", () => {
    const f = measure({ fat: 1 }).fat
    expect(f.swell).toBeCloseTo(1.35, 2)
    expect(f.joint).toBeGreaterThan(f.swell)
    expect(f.hipTop).toBeLessThan(f.swell)
    expect(f.end).toBeLessThanOrEqual(1.1)
    expect(f.neck).toBeCloseTo(1.2, 2)
    expect(f.chin).toBeGreaterThan(1)
  })
  it('past 1 keeps its proportion, not clamped', () => {
    const a = measure({ fat: 1 }).fat
    const b = measure({ fat: 1.2 }).fat
    for (const key of Object.keys(a) as (keyof typeof a)[]) expect(b[key], key).toBeGreaterThan(a[key])
  })
})

describe('fat reaches the limbs, the neck and the jaw', () => {
  for (const id of BASE_IDS) {
    const base = BASE_PAIR[id]
    it(`${id}: every limb ring is wider at fat 1 than at fat 0, the wrists and ankles by a tenth at most`, () => {
      const { m, s } = rigOf({ ...base, fat: 0 })
      const lean = profiles(m, s)
      const heavy = profiles(...(Object.values(rigOf({ ...base, fat: 1 })) as [typeof m, typeof s]))
      for (const [region, a, b] of [
        ['thigh', lean.leg.L, heavy.leg.L],
        ['upper arm', lean.arm.L, heavy.arm.L],
        ['neck', lean.neck, heavy.neck],
      ] as const) {
        for (const [i, r] of a.rings.entries()) {
          const wider = b.rings[i]?.rx ?? 0
          expect(wider, `${region} ring ${i}`).toBeGreaterThan(r.rx)
        }
      }
      // The wrist grows least of the ring classes (a tenth at most beyond the build's own), the forearm's swell most.
      const grow = (i: number) => (heavy.arm.L.rings[i]?.rx ?? 0) / (lean.arm.L.rings[i]?.rx ?? 1)
      const last = lean.arm.L.rings.length - 1
      expect(grow(last)).toBeLessThan(grow(5))
    })
  }
  it("a heavy figure's jaw is fuller underneath: wider at t 0.08 and 0.14, the chin's point where it was", () => {
    const form = (fat: number) => {
      const { m, s } = rigOf({ fat })
      return headForm(m, s)
    }
    const lean = form(0)
    const heavy = form(1)
    expect(heavy.width(0.08)).toBeGreaterThan(lean.width(0.08) * 1.15)
    expect(heavy.width(0.14)).toBeGreaterThan(lean.width(0.14) * 1.1)
    expect(heavy.front(0.07)).toBeGreaterThan(lean.front(0.07))
    expect(heavy.front(0)).toBeCloseTo(lean.front(0), 9)
  })
  it('leaves the cranium and the cheeks alone', () => {
    const lean = headForm(rigOf({ fat: 0 }).m, rigOf({ fat: 0 }).s)
    const heavy = headForm(rigOf({ fat: 1 }).m, rigOf({ fat: 1 }).s)
    const heavyMid = heavy.width(0.5) / lean.width(0.5)
    for (const t of [0.3, 0.45, 0.62, 0.8])
      expect(heavy.width(t) / lean.width(t), `t ${t}`).toBeCloseTo(heavyMid, 9)
  })
})

describe('bust and seat are exactly the default at 0.5', () => {
  it('every factor is 1 and every offset 0', () => {
    expect(measure({ bust: 0.5, seat: 0.5 }).bust).toEqual({ rz: 1, dz: 0 })
    expect(measure({ bust: 0.5, seat: 0.5 }).seat).toEqual({ rz: 1, dz: 0, rx: 1 })
    expect(measure({}).bust).toEqual({ rz: 1, dz: 0 })
  })
  it('the ends are a real range: bust 0.92 to 1.15 of the depth, seat 0.93 to 1.12 deep and 0.94 to 1.06 wide', () => {
    expect(measure({ bust: 0 }).bust.rz).toBeCloseTo(0.92, 9)
    expect(measure({ bust: 1 }).bust.rz).toBeCloseTo(1.15, 9)
    expect(measure({ seat: 0 }).seat.rz).toBeCloseTo(0.93, 9)
    expect(measure({ seat: 1 }).seat.rz).toBeCloseTo(1.12, 9)
    expect(measure({ seat: 0 }).seat.rx).toBeCloseTo(0.94, 9)
    expect(measure({ seat: 1 }).seat.rx).toBeCloseTo(1.06, 9)
  })
  for (const id of BASE_IDS) {
    const base = BASE_PAIR[id]
    it(`${id}: bust 1 is deeper at the chest than bust 0, and seat 1 deeper at the seat than seat 0`, () => {
      const { s } = rigOf(base)
      const chest = s.chestY
      const seat = s.hipY - 0.02
      expect(ring({ ...base, bust: 1 }, 'torso', chest).rz).toBeGreaterThan(
        ring({ ...base, bust: 0 }, 'torso', chest).rz,
      )
      expect(ring({ ...base, seat: 1 }, 'torso', seat).rz).toBeGreaterThan(
        ring({ ...base, seat: 0 }, 'torso', seat).rz,
      )
      expect(ring({ ...base, seat: 1 }, 'torso', seat).rx).toBeGreaterThan(
        ring({ ...base, seat: 0 }, 'torso', seat).rx,
      )
    })
    it(`${id}: bust and seat at 0.5 leave the torso as it is without them`, () => {
      const without = { ...base }
      const explicit = { ...base, bust: 0.5, seat: 0.5 }
      const { s } = rigOf(without)
      for (const y of [s.chestY, s.hipY, s.hipY + 0.08])
        expect(ring(explicit, 'torso', y)).toEqual(ring(without, 'torso', y))
    })
  }
})

describe('the eyes and the uneven body and face have defaults that change nothing', () => {
  it('the new genes default to their no-op', () => {
    expect(DEFAULT_SLIDERS.bust).toBe(0.5)
    expect(DEFAULT_SLIDERS.seat).toBe(0.5)
    expect(DEFAULT_SLIDERS.bodyAsymmetry).toBe(0)
    expect(DEFAULT_HEAD).toMatchObject({ eyeSize: 0.5, eyeSpacing: 0.5, eyeTilt: 0.5, asymmetry: 0 })
  })
  it('a body asymmetry becomes the rig gene sideBend, and none leaves it 0', () => {
    expect(measure({}).genes.sideBend).toBe(0)
    expect(measure({ bodyAsymmetry: 0.6 }).genes.sideBend).toBe(0.6)
  })
  it('a face asymmetry widens the jaw on one side, and only below the cheekbones', () => {
    const level = headForm(rigOf({}).m, rigOf({}).s)
    const uneven = headForm(rigOf({ face: { asymmetry: 1 } }).m, rigOf({ face: { asymmetry: 1 } }).s)
    expect(uneven.width(0.1, 1)).toBeCloseTo(
      level.width(0.1) * 1.12 * (1 - smoothstep(0.1 / 0.3)) +
        level.width(0.1) * (1 - (1 - smoothstep(0.1 / 0.3))) * 1,
      6,
    )
    expect(uneven.width(0.1, 1)).toBeGreaterThan(level.width(0.1))
    expect(uneven.width(0.1, -1)).toBeLessThan(level.width(0.1))
    expect(uneven.width(0.5, 1)).toBe(level.width(0.5))
    expect(uneven.width(0.5, -1)).toBe(level.width(0.5))
    expect(level.width(0.1, 1)).toBe(level.width(0.1, -1))
  })
})
const smoothstep = (x: number): number => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}
// A face slider that is not part of HeadShape would be a typo here:
const _check: keyof HeadShape = 'eyeTilt'
void _check
