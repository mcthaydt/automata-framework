import { beforeAll, describe, expect, it } from 'vitest'
import { BASE_PAIR } from '#src/features/figures/base/base-pair.ts'
import { measure } from '#src/features/figures/body/genes.ts'
import { GROUP } from '#src/features/figures/body/mesh.ts'
import { profiles } from '#src/features/figures/body/profiles.ts'
import { J, skeletonFromGenes } from '#src/features/figures/body/rig.ts'
import { arcOf, clothFrame, clothSlots, clothU, slotAt } from '#src/features/figures/paint/cloth.ts'
import { registerFixtures } from './fabric-fixtures.ts'

beforeAll(registerFixtures)

const rig = (sliders = BASE_PAIR.man.sliders) => {
  const m = measure(sliders)
  const s = skeletonFromGenes({ ...m.genes })
  const p = profiles(m, s)
  return { m, s, p, f: clothFrame(p) }
}
const perimeter = (A: number, B: number): number =>
  Math.PI * (3 * (A + B) - Math.sqrt((3 * A + B) * (A + 3 * B)))
const must = <T>(x: T | null | undefined): T => {
  if (x === undefined || x === null) throw new Error('missing')
  return x
}

describe('cloth coordinates (the mapping)', () => {
  it('the wrap lies at centre back for the torso', () => {
    const { f } = rig()
    const c = must(f.get(GROUP.torso))
    const half = perimeter(c.A, c.B) / 2
    const a = must(clothU(f, GROUP.torso, Math.cos(0.999 * Math.PI), Math.sin(0.999 * Math.PI)))
    const b = must(clothU(f, GROUP.torso, Math.cos(-0.999 * Math.PI), Math.sin(-0.999 * Math.PI)))
    expect(a).toBeCloseTo(half, 2)
    expect(b).toBeCloseTo(-half, 2)
    // Centre front is zero; the skirt shares the trunk's cylinder (a skirt's centre-back seam is tailoring).
    expect(clothU(f, GROUP.torso, 1, 0)).toBeCloseTo(0, 9)
    expect(f.get(GROUP.skirt)).toBe(c)
  })
  it("a cape has its own cylinder, the trunk's shape with the wrap at centre front", () => {
    const { f } = rig()
    const cape = must(f.get(GROUP.cape))
    const trunk = must(f.get(GROUP.torso))
    const y = 1.2
    const R = cape.ring(y)
    const half = perimeter(cape.A, cape.B) / 2
    expect(cape).not.toBe(trunk)
    expect([cape.A, cape.B]).toEqual([trunk.A, trunk.B])
    // A vertex at centre back: the angle is near 0, u near 0.
    const back = slotAt(cape, R.dx ?? 0, y, (R.dz ?? 0) - R.rz)
    expect(Math.atan2(back[1], back[0])).toBeCloseTo(0, 6)
    expect(clothU(f, GROUP.cape, back[0], back[1])).toBeCloseTo(0, 6)
    // No jump in u across centre back: points 5 mm either side of it differ by about 10 mm of arc, not by the perimeter.
    const uAt = (dxm: number): number => {
      const [c, sn] = slotAt(
        cape,
        (R.dx ?? 0) + dxm,
        y,
        (R.dz ?? 0) - R.rz * Math.sqrt(1 - (dxm / R.rx) ** 2),
      )
      return must(clothU(f, GROUP.cape, c, sn))
    }
    expect(Math.abs(uAt(0.005) - uAt(-0.005))).toBeLessThan(0.02)
    // The wrap is at centre front: u is a half perimeter either way there.
    const front = (sx: number): number => {
      const [c, sn] = slotAt(cape, (R.dx ?? 0) + sx, y, (R.dz ?? 0) + R.rz * Math.sqrt(1 - (sx / R.rx) ** 2))
      return must(clothU(f, GROUP.cape, c, sn))
    }
    expect(front(0.002)).toBeLessThan(-half * 0.98)
    expect(front(-0.002)).toBeGreaterThan(half * 0.98)
  })
  it('the wrap lies on the inside of each limb', () => {
    const { f, s } = rig()
    for (const [group, side] of [
      [GROUP.armL, 1],
      [GROUP.armR, -1],
      [GROUP.legL, 1],
      [GROUP.legR, -1],
    ] as const) {
      const c = must(f.get(group))
      const y = must(s.rest[J.pelvis])[1] * 0.5
      const R = c.ring(y)
      const inside = slotAt(c, (R.dx ?? 0) - side * R.rx, y, R.dz ?? 0)
      const outside = slotAt(c, (R.dx ?? 0) + side * R.rx, y, R.dz ?? 0)
      expect(Math.abs(Math.atan2(inside[1], inside[0]))).toBeCloseTo(Math.PI, 6)
      expect(Math.atan2(outside[1], outside[0])).toBeCloseTo(0, 6)
      expect(inside[2]).toBeCloseTo(-y, 9)
    }
    expect(f.get(GROUP.head)).toBeUndefined()
    expect(f.get(GROUP.item)).toBeUndefined()
  })
  it('limbs mirror: front is the same side of the wrap on both', () => {
    const { f } = rig()
    const y = 1.2
    const front = (g: number, side: number): number => {
      const c = must(f.get(g))
      const R = c.ring(y)
      return slotAt(c, R.dx ?? 0, y, (R.dz ?? 0) + R.rz)[1] * side
    }
    expect(front(GROUP.armL, 1)).toBeGreaterThan(0.99)
    expect(front(GROUP.armR, -1)).toBeLessThan(-0.99)
  })
  it('u is arc length on the ellipse', () => {
    for (const limb of [false, true]) {
      const arc = arcOf(0.2, 0.1, limb)
      expect(arc).toHaveLength(257)
      expect(arc[128]).toBeCloseTo(0, 9)
      const P = perimeter(0.2, 0.1)
      expect(Math.abs(must(arc[256]) - must(arc[0]) - P) / P).toBeLessThan(0.005)
      expect(Math.abs(must(arc[192]) - must(arc[128]) - P / 4) / (P / 4)).toBeLessThan(0.01)
    }
  })
  it('u is the same at every height for one angle: no shear', () => {
    const { f, s } = rig()
    const torso = must(f.get(GROUP.torso))
    const lo = s.hipY + 0.09
    const hi = s.chestY - 0.07
    for (const t of [-2.6, -1.1, 0.3, 1.4, 2.9]) {
      const us: number[] = []
      for (let i = 0; i < 10; i++) {
        const y = lo + ((hi - lo) * i) / 9
        const R = torso.ring(y)
        const [c, sn] = slotAt(torso, (R.dx ?? 0) + R.rx * Math.sin(t), y, (R.dz ?? 0) + R.rz * Math.cos(t))
        us.push(must(clothU(f, GROUP.torso, c, sn)))
      }
      for (const u of us) expect(Math.abs(u - must(us[0])), `angle ${t}`).toBeLessThan(1e-9)
    }
  })
  it('every cylinder is finite and positive at every slider end of the base pair', () => {
    for (const key of ['fat', 'muscle', 'height', 'frame'] as const) {
      for (const v of key === 'height' ? [150, 200] : [0, 1]) {
        const { f } = rig({ ...BASE_PAIR.woman.sliders, [key]: v })
        for (const c of f.values()) {
          expect(c.A, `${key} ${v}`).toBeGreaterThan(0)
          expect(c.B, `${key} ${v}`).toBeGreaterThan(0)
          for (const x of c.arc) expect(Number.isFinite(x), `${key} ${v}`).toBe(true)
        }
      }
    }
  })
  it('clothSlots keeps part order, with zeros for an untiled group', () => {
    const { s, f } = rig()
    const mesh = (positions: number[]) =>
      ({ positions, normals: positions.map(() => 0), indices: [0, 1, 2] }) as never
    const body = {
      mesh: mesh([0, 1.2, 0.1, 0.05, 1.1, 0.1, -0.05, 1.0, 0.1]),
      material: 'a',
      group: GROUP.torso,
    }
    const head = {
      mesh: mesh([0, 1.7, 0.1, 0.05, 1.6, 0.1, -0.05, 1.5, 0.1]),
      material: 'a',
      group: GROUP.head,
    }
    const slots = clothSlots([body, head], s, f)
    expect(slots).toHaveLength(18)
    const torso = must(f.get(GROUP.torso))
    expect([...slots.slice(0, 3)]).toEqual(slotAt(torso, 0, 1.2, 0.1).map((x) => Math.fround(x)))
    expect([...slots.slice(9)]).toEqual(new Array(9).fill(0))
  })
})
