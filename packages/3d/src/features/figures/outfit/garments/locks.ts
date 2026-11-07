// The kit's one rounded box, and locks: rounded boxes of hair or headwear in head units (x of the head's
// half-width, y of its height above the chin, z of its half-depth), so a style fits any head the sliders
// make.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`box`,
// `lockParts`, `named`), with AF's strict types; the formulas and their order are the source's.

import { axisAngle, type V3 } from '../../../../shared/math/math.ts'
import { type Superquadric, superquadric } from '../../../../shared/math/superquadric.ts'
import type { Part } from '../../body/mesh.ts'
import { at, J, type Skeleton } from '../../body/rig.ts'
import type { Lock } from '../../content/headwear.schema.ts'

/** A rounded box: the kit's one primitive. */
export const box = (
  bone: number,
  material: string,
  group: number,
  o: Superquadric,
  extra: Partial<Part> = {},
): Part => ({
  bone,
  material,
  group,
  mesh: superquadric({ e: [0.5, 0.55], seg: 10, rings: 6, ...o }),
  ...extra,
})

/** A library item by id, or the value written inline; an unknown id is named. */
export function named<T>(library: Readonly<Record<string, T>>, kind: string, style: string | T): T {
  if (typeof style !== 'string') return style
  const found = library[style]
  if (found === undefined) throw new Error(`no ${kind} ${style}`)
  return found
}

/**
 * Locks into parts on the head and the hair joints, fitted to the skeleton's head. `on`: the head, or a hair
 * joint that swings (`back`; `sides`, one each side, mirrored). `rk` adds metres scaled to the figure (a
 * cap's stiff band); `follow` the share of the face's forward set the lock takes; `cut` drops the triangles
 * below `below` and in front of `front` (unit space), a crown that must not cover the cheeks.
 */
export function lockParts(
  s: Skeleton,
  k: number,
  material: string,
  group: number,
  locks: readonly Lock[],
): Part[] {
  const g = s.genes
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
  const out: Part[] = []
  for (const lock of locks)
    for (const x of lock.on === 'sides' ? [1, -1] : [0]) {
      const sign = lock.on === 'sides' ? x : 1
      const rk = lock.rk ?? [0, 0, 0]
      const place: V3 = [
        hw * (sign * lock.at[0]),
        h * lock.at[1],
        hd * (lock.at[2] + (lock.follow ?? 0) * g.faceAhead),
      ]
      const o: Superquadric = {
        at: place,
        r: [hw * lock.r[0] + k * rk[0], h * lock.r[1] + k * rk[1], hd * lock.r[2] + k * rk[2]],
      }
      if (lock.e) o.e = [...lock.e]
      if (lock.taper) o.taper = [...lock.taper]
      if (lock.shear) o.shear = [...lock.shear]
      if (lock.roll !== undefined) o.turn = axisAngle([0, 0, 1], sign * lock.roll)
      if (lock.pitch !== undefined) o.turn = axisAngle([1, 0, 0], lock.pitch)
      if (lock.cut) {
        const { below, front } = lock.cut
        o.keep = (_x, y, z) => !(y < below && z > front)
      }
      const joint =
        lock.on === 'head' ? null : lock.on === 'back' ? J['hair.back'] : J[x > 0 ? 'hair.L' : 'hair.R']
      if (joint === null) {
        out.push(box(J.head, material, group, o))
        continue
      }
      const pivot = at(s.offset, joint)
      out.push(
        box(joint, material, group, {
          ...o,
          at: [place[0] - pivot[0], place[1] - pivot[1], place[2] - pivot[2]],
        }),
      )
    }
  return out
}
