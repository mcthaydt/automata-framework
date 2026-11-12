import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { measure, type Sliders } from '#src/shared/body/genes.ts'
import { GROUP } from '#src/shared/body/parts.ts'
import { J, skeleton } from '#src/shared/body/rig.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { bodyOf } from '#src/shared/outfit/fit.ts'
import { dress } from '#src/shared/outfit/garments.ts'
import type { ShoeForm } from '#src/shared/outfit/shoe.ts'
import { differs, dressed, turned } from '../../fixtures/draw'
import { pinned } from '../../fixtures/pins'
import { BODY, endsOf } from '../body/ends'
import { shod, shodToo, useFixtures } from './wardrobe-fixtures'

useFixtures()
/**
 * The shod foot's form (outfit/shoe.ts, `Fit.shoe`): a shaft, a low heel, a thicker sole and a toe cap, each drawn on the
 * base pair against the plain shoe. A shoe with no form is today's: the pinned cell of before c9 (`shodPlain`), and the
 * parts of the figure are today's in today's order.
 */
const SC = Math.cos((18 * Math.PI) / 180),
  SS = Math.sin((18 * Math.PI) / 180)
const FORMS: Record<string, ShoeForm> = {
  ankle: { shaft: 0.15 },
  mid: { shaft: 0.5 },
  knee: { shaft: 1 },
  heel: { heel: 1 },
  thick: { sole: 2 },
  cap: { cap: 'wood' },
}
const wear = (i: number, form?: ShoeForm, sliders?: Partial<Sliders>) =>
  dressed([...BASE[i].def.outfits.base, shod('charcoal', form)], undefined, {
    ...BASE[i].def,
    sliders: { ...BASE[i].def.sliders, ...sliders },
  })
/** A figure standing at `d` eighths of a turn, density 2: its painted cell and the cell's feet row. */
function stand(def: ReturnType<typeof wear>, d: number) {
  const cast = member(def, 2),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return {
    f,
    px: f.painted.slice(),
    w: cast.cell[0],
    h: cast.cell[1],
    feet: cast.feet,
    ppm: cast.cell[1] / cast.metres,
  }
}
/** The row (counting from the top) at which a point `y` m above the floor and `z` m ahead of the root shows. */
const rowOf = (s: { h: number; feet: number; ppm: number }, y: number, z: number) =>
  Math.floor(s.h - s.feet - (y * SC - z * SS) * s.ppm)
type Stand = ReturnType<typeof stand>
/**
 * The rows at which two figures' surfaces differ: the G-buffer's part, group or depth (what is built and where), not the painted
 * colours, which the painter's colour budget moves across the whole figure when a new colour or a few texels come in.
 */
function diffRows(a: Stand, b: Stand) {
  const rows = new Set<number>(),
    A = a.f.g,
    B = b.f.g
  for (let k = 0; k < A.w * A.h; k++)
    if (
      A.part[k] !== B.part[k] ||
      A.group[k] !== B.group[k] ||
      (A.depth[k] !== B.depth[k] && Math.abs(A.depth[k] - B.depth[k]) > 1e-6)
    )
      rows.add(Math.floor(k / A.w))
  return [...rows].sort((x, y) => x - y)
}
const foot = (i: number) => {
  const m = measure(BASE[i].def.sliders)
  return bodyOf(m, skeleton(m.genes), 73.8).foot
}

describe("the shod foot's form", () => {
  it('with no form is the cell it drew before c9 (the pin)', () => {
    expect(
      createHash('md5')
        .update(turned(wear(0)))
        .digest('hex'),
    ).toBe(pinned('shodPlain'))
  })
  for (const i of [0, 1])
    for (const [name, form] of Object.entries(FORMS)) {
      it(`${BASE[i].def.id}: ${name} differs from the plain shoe, and only below ${form.shaft ? 'the knee' : "the shoe's top"}`, () => {
        const F = foot(i)
        for (const d of form.cap ? [0, 2] : [0, 2, 4]) {
          const a = stand(wear(i), d),
            b = stand(wear(i, form), d),
            rows = diffRows(a, b)
          expect(rows.length, `view ${d}`).toBeGreaterThan(0)
          // The highest a point of the foot or the shaft can show (a point a body's depth behind the root, a row of slack): nothing above differs.
          expect(rows[0], `view ${d}: the highest differing row`).toBeGreaterThanOrEqual(
            rowOf(a, form.shaft ? F.knee : F.ankle, -0.15) - 1,
          )
        }
      })
    }
  it("the shaft's top row rises with the shaft: ankle < mid < knee", () => {
    for (const i of [0, 1]) {
      const plain = stand(wear(i), 0),
        top = (k: string) => diffRows(plain, stand(wear(i, FORMS[k]), 0))[0]
      expect(top('ankle')).toBeGreaterThan(top('mid'))
      expect(top('mid')).toBeGreaterThan(top('knee'))
    }
  })
  it("the figure's top row is the same with every form, and its lowest row within a texel (the foot stands on the floor, the figure's height does not move)", () => {
    const extent = (s: Stand) => {
      let lo = -1,
        hi = -1
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++)
          if (s.f.g.material[y * s.w + x] >= 0) {
            if (lo < 0) lo = y
            hi = y
          }
      return [lo, hi]
    }
    for (const i of [0, 1]) {
      const plain = extent(stand(wear(i), 0))
      for (const [name, form] of Object.entries(FORMS)) {
        const e = extent(stand(wear(i, form), 0))
        expect(e[0], `${name}: the top row`).toBe(plain[0])
        // The ball's pad is a shorter box than the plain sole, so its rounded front corner can sit a texel off: the foot stands on the same floor to within one.
        expect(Math.abs(e[1] - plain[1]), `${name}: the lowest row`).toBeLessThanOrEqual(1)
      }
    }
  })
  it('a heel over 1 builds as 1 (capped at 0.035 · k)', () => {
    expect(differs(turned(wear(1, { heel: 5 })), turned(wear(1, { heel: 1 })))).toBe(false)
    expect(differs(turned(wear(1, { heel: 0.4 })), turned(wear(1, { heel: 1 })))).toBe(true)
  })
  it("with every slider at each end and a knee shaft, no skin shows between the shaft's top and the floor", () => {
    for (const key of BODY)
      for (const v of endsOf(key)) {
        const sliders = { [key]: v } as Partial<Sliders>,
          def = wear(0, FORMS.knee, sliders),
          m = measure(def.sliders),
          B = bodyOf(m, skeleton(m.genes), 73.8),
          F = B.foot
        // The shaft's top rim, as far toward the camera as it reaches in each view (the leg's own extent there, and the shaft's texels out of it), and from three texels under the rim (a stand's lean moves the rim a texel or two).
        const top = F.knee - 0.04 * m.k,
          rim = B.at('leg', 'L', top),
          reach = {
            0: (rim.dz ?? 0) + rim.rz,
            2: Math.abs(rim.dx ?? 0) + rim.rx,
            4: rim.rz - (rim.dz ?? 0),
          } as Record<number, number>
        for (const d of [0, 2, 4]) {
          const s = stand(def, d),
            skin = (
              s.f as unknown as { built: { materialIndex: Map<string, number> } }
            ).built.materialIndex.get(def.skin)!,
            g = s.f.g
          // Below the shaft's top rim as its front edge shows (the opening above it shows the leg inside, which is skin); a row of slack.
          for (let y = rowOf(s, top - 0.04, reach[d] + 3 * B.clear) + 1; y < s.h; y++)
            for (let x = 0; x < s.w; x++) {
              const k = y * s.w + x
              if ((g.group[k] === GROUP.legL || g.group[k] === GROUP.legR) && g.material[k] === skin)
                throw new Error(`${key}=${v}, view ${d}: a skin texel at (${x}, ${y})`)
            }
        }
      }
  })
  it("two kinds that both set a shoe: the later one's form is built", () => {
    const m = measure(BASE[0].def.sliders),
      s = skeleton(m.genes),
      base = BASE[0].def.outfits.base
    const both = dress(m, s, 'skinWarm', [
        ...base,
        shod('charcoal', FORMS.knee),
        shodToo('charcoal', FORMS.heel),
      ]),
      heelOnly = dress(m, s, 'skinWarm', [...base, shod('charcoal', FORMS.heel)])
    expect(both.parts.length).toBe(heelOnly.parts.length)
  })
  it("the parts with no form are today's, and each form's first parts are today's in today's order, its additions after them", () => {
    const m = measure(BASE[0].def.sliders),
      s = skeleton(m.genes),
      base = BASE[0].def.outfits.base
    const plain = dress(m, s, 'skinWarm', [...base, shod('charcoal')]).parts,
      bare = dress(m, s, 'skinWarm', base).parts
    expect(plain.length, "a shod foot is the bare foot's part and a sole more, each side").toBe(
      bare.length + 2,
    )
    for (const [name, form] of Object.entries(FORMS)) {
      const parts = dress(m, s, 'skinWarm', [...base, shod('charcoal', form)]).parts
      expect(parts.length, name).toBeGreaterThanOrEqual(plain.length)
      plain.forEach((p, n) => {
        expect(parts[n].material, `${name} part ${n}`).toBe(p.material)
        expect(parts[n].group).toBe(p.group)
        expect(parts[n].bone).toBe(p.bone)
        // The heel and a thicker sole reshape the sole (and the upper's bottom) in place; every other part's mesh is untouched, and no seam moved but the shaft's.
        if (!form.shaft) expect(parts[n].seam).toBe(p.seam)
      })
      // The added parts (a shaft, a ball's pad, a toe cap) come after everything the plain figure has, so the grain of every earlier part is today's.
      expect(parts.slice(plain.length).every((p) => p.seam !== undefined)).toBe(true)
    }
    // A figure's untouched parts are the very same meshes: the right arm, the hair, the garments.
    const heel = dress(m, s, 'skinWarm', [...base, shod('charcoal', FORMS.heel)]).parts
    const same = plain.filter(
      (p, n) => JSON.stringify(p.mesh.positions) === JSON.stringify(heel[n].mesh.positions),
    ).length
    expect(same, "only the shoe's upper and sole change with a heel").toBeGreaterThanOrEqual(plain.length - 4)
  })
  it("Body.foot is the shod foot: its length and width are the upper's extent, its knee the rig's", () => {
    for (const i of [0, 1]) {
      const m = measure(BASE[i].def.sliders),
        s = skeleton(m.genes),
        look = dress(m, s, BASE[i].def.skin, [...BASE[i].def.outfits.base, shod('charcoal')])
      const upper = look.parts.find((p) => p.material === 'charcoal' && p.bone === J['foot.L'])!,
        P = upper.mesh.positions
      let zLo = Infinity,
        zHi = -Infinity,
        xLo = Infinity,
        xHi = -Infinity
      for (let n = 0; n < P.length; n += 3) {
        xLo = Math.min(xLo, P[n])
        xHi = Math.max(xHi, P[n])
        zLo = Math.min(zLo, P[n + 2])
        zHi = Math.max(zHi, P[n + 2])
      }
      const F = bodyOf(m, s).foot
      expect(F.length).toBeCloseTo(zHi - zLo, 9)
      expect(F.width).toBeCloseTo(xHi - xLo, 9)
      expect(F.knee).toBeCloseTo(s.hipY - s.thigh, 12)
    }
  })
  it('is drawn twice to the same texels, in 8 views, for every form', () => {
    for (const form of Object.values(FORMS))
      expect(differs(turned(wear(0, form)), turned(wear(0, form)))).toBe(false)
  })
})
