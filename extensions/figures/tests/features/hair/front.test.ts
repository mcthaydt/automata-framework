import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { BASE } from '../../../base/base'
import { measure, type Sliders } from '../../../src/features/body/genes'
import { headForm } from '../../../src/features/body/head'
import { GROUP, reach } from '../../../src/features/body/parts'
import { J, skeleton } from '../../../src/features/body/rig'
import { Figure } from '../../../src/features/figure/figure'
import { member, view } from '../../../src/features/figure/frames'
import type { HairStyle } from '../../../src/features/hair/hair'
import { onHead, skull } from '../../../src/features/hair/hair'
import { dress, type Garment, SWATCHES } from '../../../src/features/outfit/garments'
import { FALL_PLAIN, fallPlain, pinned } from '../../support/pins'
import { BODY, endsOf } from '../body/ends'
import { differs, dressed } from '../draw'

/**
 * A fall that hangs in front of the shoulders (hair.ts, `Fall.front`), reaches the waist (`length` to 2) and turns its ends
 * under or out (`turn`), drawn on base-f in the plain fall of tests/support/pins.ts against the same fall with the
 * fields left out (the pinned `fallPlain` cell of before c9).
 */
const md5 = (b: Uint8ClampedArray) => createHash('md5').update(b).digest('hex')
const SC = Math.cos((18 * Math.PI) / 180),
  SS = Math.sin((18 * Math.PI) / 180)
const HAIR = (p: number) => p >= 2000 && p < 3000
/** Base-f wearing the plain fall with these fields over it (and these sliders). */
const wear = (extra: Record<string, unknown> = {}, sliders: Partial<Sliders> = {}) => {
  const def = BASE[1].def,
    pieces = [{ fall: { ...(FALL_PLAIN.pieces[0] as { fall: object }).fall, ...extra } }],
    style = { ...FALL_PLAIN, pieces } as HairStyle
  const outfit = def.outfits.base.map((g: Garment) => ('hair' in g ? { ...g, style } : g))
  return dressed(outfit as Garment[], undefined, { ...def, sliders: { ...def.sliders, ...sliders } })
}
/** A figure standing at `d` eighths of a turn at density 2. */
function stand(extra: Record<string, unknown>, d = 0, sliders: Partial<Sliders> = {}) {
  const def = wear(extra, sliders),
    cast = member(def, 2),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return {
    f,
    def,
    w: cast.cell[0],
    h: cast.cell[1],
    feet: cast.feet,
    ppm: cast.cell[1] / cast.metres,
    m: measure(def.sliders),
  }
}
type Stand = ReturnType<typeof stand>
const rowOf = (s: Stand, y: number, z = 0) => Math.floor(s.h - s.feet - (y * SC - z * SS) * s.ppm)
/** The hair texels of a standing figure in rows from `from`, within the torso's silhouette in each row (front hair; back hair is behind the trunk there), per side of the centre. */
function frontTexels(s: Stand, from: number) {
  const g = s.f.g,
    out = { left: 0, right: 0 }
  for (let y = from; y < s.h; y++) {
    let lo = Infinity,
      hi = -Infinity
    for (let x = 0; x < s.w; x++)
      if (g.group[y * s.w + x] === GROUP.torso) {
        lo = Math.min(lo, x)
        hi = Math.max(hi, x)
      }
    for (let x = lo + 2; x <= hi - 2; x++)
      if (HAIR(g.part[y * s.w + x])) x < s.w / 2 ? out.left++ : out.right++
  }
  return out
}
/** The lowest row with a hair texel. */
const lowest = (s: Stand) => {
  let r = -1
  for (let k = 0; k < s.w * s.h; k++) if (HAIR(s.f.g.part[k])) r = Math.max(r, Math.floor(k / s.w))
  return r
}
/** The face's rows (the eye line to the chin) and the columns between its eyes' outer edges, less the edge texel itself: a rope's texel beside the eye is not across it (the drawn face's stamp, view 0). */
function faceBox(s: Stand) {
  const st = (
    s.f as unknown as {
      faceStamp: {
        eyes: [[number, number], [number, number]]
        eye: number
        frame: { o: [number, number, number] }
      }
    }
  ).faceStamp
  return {
    x0: Math.floor(st.eyes[0][0] - st.eye / 2) + 1,
    x1: Math.ceil(st.eyes[1][0] + st.eye / 2) - 1,
    y0: Math.floor(Math.min(st.eyes[0][1], st.eyes[1][1])),
    y1: Math.floor(st.frame.o[1]) - 1,
  }
}
/** Whether hair lies across the face: a hair texel on a row of the face (the eye line to the chin) with the face's skin (the head's own surface, seam 1000) either side of it. Hair beside the cheek or the jaw is not across it. */
function crossesFace(s: Stand) {
  const { y0, y1 } = faceBox(s),
    g = s.f.g,
    skin = (x: number, y: number) =>
      x >= 0 && x < s.w && g.part[y * s.w + x] === 1000 && g.material[y * s.w + x] >= 0
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < s.w; x++) {
      if (!HAIR(g.part[y * s.w + x])) continue
      let left = false,
        right = false
      for (let d = 1; d <= 8; d++) {
        left ||= skin(x - d, y)
        right ||= skin(x + d, y)
      }
      if (left && right) return true
    }
  return false
}
const FRONT = { front: 0.5, length: 1 }

describe('a fall in front of the shoulders', () => {
  it('with the fields left out, or at their defaults, is the plain fall of before c9 (the pin)', () => {
    expect(md5(fallPlain())).toBe(pinned('fallPlain'))
    expect(md5(fallPlain({ front: 0, turn: 0 }))).toBe(pinned('fallPlain'))
  })
  it('front: 0 leaves no hair on the trunk in front; front: 0.5 hangs some on both sides', () => {
    const none = stand({ front: 0, length: 1 }),
      some = stand(FRONT),
      from = rowOf(some, skeleton(some.m.genes).shoulderY - 0.03)
    expect(frontTexels(none, from)).toEqual({ left: 0, right: 0 })
    const t = frontTexels(some, from)
    expect(t.left, 'left').toBeGreaterThan(3)
    expect(t.right, 'right').toBeGreaterThan(3)
  })
  it("never crosses the face: no hair between the eyes' outer edges on a row of the face, with the head and eye sliders at both ends", () => {
    for (const key of [
      'head',
      'headWidth',
      'headDepth',
      'browHeight',
      'eyeSize',
      'eyeSpacing',
      'neckLength',
    ] as const) {
      for (const v of key === 'browHeight' || key === 'eyeSize' || key === 'eyeSpacing'
        ? [0, 1]
        : endsOf(key as keyof Sliders)) {
        const sliders =
          key === 'browHeight' || key === 'eyeSize' || key === 'eyeSpacing'
            ? { face: { ...BASE[1].def.sliders.face, [key]: v } }
            : { [key]: v }
        expect(
          crossesFace(stand({ front: 1, length: 1 }, 0, sliders as Partial<Sliders>)),
          `${key}=${v}`,
        ).toBe(false)
      }
    }
  })
  it('a front clump is outside the dressed trunk in rest space, with fat, bust, muscle, neckLength and shoulders at each end', () => {
    for (const key of ['fat', 'bust', 'muscle', 'neckLength', 'shoulders'] as const)
      for (const v of endsOf(key)) {
        const def = wear({ ...FRONT, front: 1, length: 1.5 }, { [key]: v } as Partial<Sliders>),
          m = measure(def.sliders),
          s = skeleton(m.genes)
        const look = dress(m, s, def.skin, def.outfits[def.default] as Garment[], {
          ...SWATCHES,
          ...def.swatches,
        })
        const trunk = look.parts.filter((p) => p.group === GROUP.torso),
          hair = look.parts.filter((p) => p.skin && p.seam !== undefined && p.seam >= 2000 && p.seam < 3000)
        expect(hair.length).toBeGreaterThan(0)
        for (const p of hair)
          for (let i = 0; i < p.mesh.positions.length; i += 3) {
            const [x, y, z] = [p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]]
            if (y > s.shoulderY - 0.02) continue
            const f = reach(trunk, s.rest, [x, y, 0], [0, 0, 1]),
              b = reach(trunk, s.rest, [x, y, 0], [0, 0, -1])
            if (f > 0 && b > 0)
              expect(
                z >= f || z <= -b,
                `${key}=${v}: a vertex inside the trunk at (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`,
              ).toBe(true)
          }
      }
  })
  it('length 2 reaches lower than length 1, seen from behind', () => {
    expect(lowest(stand({ length: 2 }, 4))).toBeGreaterThan(lowest(stand({ length: 1 }, 4)))
  })
  it('turn bends the ends only: turn ±1 differ from turn 0 only below the jaw, and in the cell', () => {
    // The hair's vertices in rest space. A rope's rings are sampled at a count that follows its length, so the vertices of a turned rope are not
    // the plain rope's moved: each vertex of the plain hair is matched to the nearest vertex of the turned (the same rope's), and a turn is
    // what moves one by over 8 mm (an end moves by up to two rope radii, about 2.8 cm).
    const verts = (extra: Record<string, unknown>) => {
      const def = wear(extra),
        m = measure(def.sliders),
        s = skeleton(m.genes),
        look = dress(m, s, def.skin, def.outfits[def.default] as Garment[], { ...SWATCHES, ...def.swatches })
      return {
        s,
        m,
        hair: look.parts.filter((p) => p.skin && p.seam !== undefined && p.seam >= 2000 && p.seam < 3000),
      }
    }
    const base = verts({ length: 1 }),
      jaw = onHead(headForm(base.m, base.s), skull(base.s), 1, -0.76)[1] + base.s.rest[J.head][1]
    for (const turn of [1, -1]) {
      const t = verts({ length: 1, turn })
      let moved = 0,
        highest = -Infinity
      base.hair.forEach((p, n) => {
        const A = p.mesh.positions,
          B = t.hair[n].mesh.positions
        for (let i = 0; i < A.length; i += 3) {
          let best = Infinity
          for (let j = 0; j < B.length; j += 3)
            best = Math.min(best, Math.hypot(A[i] - B[j], A[i + 1] - B[j + 1], A[i + 2] - B[j + 2]))
          if (best > 0.008) {
            moved++
            highest = Math.max(highest, A[i + 1])
          }
        }
      })
      expect(moved, `turn ${turn}: vertices moved`).toBeGreaterThan(0)
      // The jaw: where a clump's path leaves the head's form (onHead at −0.76 of its height, as the fall's own path takes it), a centimetre of slack.
      expect(highest, `turn ${turn}: the highest vertex moved`).toBeLessThanOrEqual(jaw + 0.01)
      expect(
        differs(stand({ length: 1, turn }, 0).f.painted, stand({ length: 1 }, 0).f.painted),
        `turn ${turn}: the cell`,
      ).toBe(true)
    }
  })
  it('is drawn twice to the same texels and builds in all 8 views', () => {
    for (let d = 0; d < 8; d++)
      expect(
        differs(
          stand({ front: 0.5, length: 1.6, turn: 0.4 }, d).f.painted,
          stand({ front: 0.5, length: 1.6, turn: 0.4 }, d).f.painted,
        ),
      ).toBe(false)
  })
})
