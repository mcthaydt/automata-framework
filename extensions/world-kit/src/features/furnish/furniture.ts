// Layer 1: furniture. Each of the kit's slots in order, `n` pieces each, each on the first free spot its rule offers.
//
// Ported from the world generator this kit grew out of (`spotsFor`,
// `furniture`).

import type { Segment } from '@automata/3d/props-kit'
import { inside, inward, signedArea, type V2 } from '@automata/3d/props-kit'
import {
  alongSeg,
  type Ctx,
  dirOf,
  featuresOf,
  fits,
  footprintOf,
  lengthOf,
  place,
  solidSegs,
} from './context.ts'
import { angleOf, atSpot, centroidOf, reachAlong, type Spot, shuffle, turned } from './floor-plan.ts'
import type { SlotRule } from './kit.schema.ts'

/** The spots a piece of `w` × `d` may take under `rule`, in the order to try them. */
function spotsFor(c: Ctx, rule: SlotRule, w: number, d: number): Spot[] {
  const solid = solidSegs(c)
  const out: Spot[] = []
  /** A piece with its back to a wall at the point `p` of segment `g`, facing into the room. */
  const against = (g: Segment, p: V2): Spot => {
    const n = inward(c.level, g)
    return {
      at: [p[0] + n[0] * (d / 2 + 0.02), p[1] + n[1] * (d / 2 + 0.02)],
      angle: angleOf(n[0], n[1]),
    }
  }
  if (rule === 'wall') {
    for (const g of solid) {
      const dir = dirOf(g)
      const length = lengthOf(g)
      for (let t = 0.15; t <= length - 0.15 + 1e-9; t += 0.1)
        out.push(against(g, [g.a[0] + dir[0] * t, g.a[1] + dir[1] * t]))
    }
    return shuffle(out, c.next)
  }
  if (rule === 'window') {
    for (const g of solid)
      for (const feature of featuresOf(c, g)) {
        const p = feature.kind === 'window' ? alongSeg(g, feature.pos) : null
        const dir = dirOf(g)
        if (p !== null)
          for (const o of [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15])
            out.push(against(g, [p[0] + dir[0] * o, p[1] + dir[1] * o]))
      }
    return shuffle(out, c.next)
  }
  if (rule === 'corner') {
    const ring = c.poly
    const sign = Math.sign(signedArea(ring)) || 1
    // The solid segment that is a whole edge of the outline (an edge cut by a portal is not a wall to stand in a corner of).
    const edgeSeg = (edge: number): Segment | null => {
      const segs = c.segs.filter((g) => g.ring === 0 && g.edge === edge)
      return segs.length > 0 && segs.every((g) => solid.includes(g)) ? (segs[0] as Segment) : null
    }
    ring.forEach((p, i) => {
      const e0 = (i + ring.length - 1) % ring.length
      const [g0, g1] = [edgeSeg(e0), edgeSeg(i)]
      const [a, b] = [ring[e0] as V2, ring[(i + 1) % ring.length] as V2]
      // An inside angle under 180°, between two solid walls.
      if (
        g0 === null ||
        g1 === null ||
        ((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) * sign <= 0
      )
        return
      const [n0, n1] = [inward(c.level, g0), inward(c.level, g1)]
      const bisector: V2 = [n0[0] + n1[0], n0[1] + n1[1]]
      // Facing the bisector, rounded to the nearer wall's own angle (the back to that wall).
      const face =
        n0[0] * bisector[0] + n0[1] * bisector[1] >= n1[0] * bisector[0] + n1[1] * bisector[1] ? n0 : n1
      const angle = angleOf(face[0], face[1])
      const k0 = reachAlong(n0, w, d, angle) + 0.05
      const k1 = reachAlong(n1, w, d, angle) + 0.05
      out.push({ at: [p[0] + n0[0] * k0 + n1[0] * k1, p[1] + n0[1] * k0 + n1[1] * k1], angle })
    })
    return shuffle(out, c.next)
  }
  if (rule === 'centre') {
    // The centroid first, then a 0.5 m grid spiralling outward from it (by distance).
    const [cx, cz] = centroidOf(c.poly)
    const xs = c.poly.map((p) => p[0])
    const zs = c.poly.map((p) => p[1])
    const grid: V2[] = []
    for (let x = Math.floor(Math.min(...xs) * 2) / 2; x <= Math.max(...xs); x += 0.5)
      for (let z = Math.floor(Math.min(...zs) * 2) / 2; z <= Math.max(...zs); z += 0.5)
        if (inside(c.poly, x, z)) grid.push([x, z])
    grid.sort(
      (p, q) =>
        Math.hypot(p[0] - cx, p[1] - cz) - Math.hypot(q[0] - cx, q[1] - cz) ||
        Math.atan2(p[1] - cz, p[0] - cx) - Math.atan2(q[1] - cz, q[0] - cx),
    )
    return [[cx, cz] as V2, ...grid].map((at) => ({ at, angle: 90 }))
  }
  // rows: facing the longest solid wall, parallel to it from 1.2 m in, the rows d + 0.6 m apart, the pieces w + 0.05 m apart.
  const longest = solid.reduce<Segment | null>(
    (best, s) => (best === null || lengthOf(s) > lengthOf(best) ? s : best),
    null,
  )
  if (longest === null) return out
  const n = inward(c.level, longest)
  const dir = dirOf(longest)
  const length = lengthOf(longest)
  const angle = angleOf(-n[0], -n[1])
  for (let row = 0; row < 8; row++)
    for (let t = 0.15 + w / 2; t + w / 2 <= length - 0.15 + 1e-9; t += w + 0.05) {
      const distance = 1.2 + row * (d + 0.6)
      out.push({
        at: [longest.a[0] + dir[0] * t + n[0] * distance, longest.a[1] + dir[1] * t + n[1] * distance],
        angle,
      })
    }
  return shuffle(out, c.next)
}

/** The furniture layer. A piece that finds no free spot is skipped. */
export function furniture(c: Ctx): void {
  for (const slot of c.kit.furniture) {
    const n = Math.min(
      slot.max ?? Number.POSITIVE_INFINITY,
      Math.max(slot.min ?? 0, Math.round(c.area * c.density * slot.per)),
    )
    for (let k = 0; k < n; k++) {
      const use =
        typeof slot.use === 'string' ? slot.use : (slot.use[Math.floor(c.next() * slot.use.length)] as string)
      const f = footprintOf(c.library, { use, with: slot.with })
      const spot = spotsFor(c, slot.rule, f.w, f.d).find((s) => fits(c, s, f.w, f.d))
      if (spot === undefined) continue
      place(
        c,
        'furniture',
        { use, ...(slot.with === undefined ? {} : { with: slot.with }), at: atSpot(spot), angle: spot.angle },
        turned(spot.at, f.w, f.d, spot.angle).rect,
      )
    }
  }
}
