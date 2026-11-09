import type { PlanPoint } from '@automata/places'
import { hypot } from '@automata/sim/math'

// Walls from a grid: the cells of an IntGrid layer whose value is solid, each `cell` metres across, with the top-left
// cell's corner at the plan's origin. Plain arithmetic in a fixed order, so every engine answers the same.

/** Whether the open rectangle (l, t)-(r, b) is crossed by the segment a→b: touching its edge or corner is not crossing. */
function crossesInterior(
  a: PlanPoint,
  b: PlanPoint,
  l: number,
  t: number,
  r: number,
  bottom: number,
): boolean {
  let from = 0
  let to = 1
  const slab = (start: number, delta: number, low: number, high: number): boolean => {
    if (delta === 0) return start > low && start < high
    const near = (low - start) / delta
    const far = (high - start) / delta
    from = Math.max(from, Math.min(near, far))
    to = Math.min(to, Math.max(near, far))
    return true
  }
  return slab(a.x, b.x - a.x, l, r) && slab(a.z, b.z - a.z, t, bottom) && from < to
}

/** How far the point (x, z) is from the closed rectangle (l, t)-(r, b); 0 inside it. */
function pointToRect(x: number, z: number, l: number, t: number, r: number, bottom: number): number {
  const dx = Math.max(l - x, 0, x - r)
  const dz = Math.max(t - z, 0, z - bottom)
  return hypot(dx, dz)
}

/** How far the point (x, z) is from the segment a→b. */
function pointToSegment(x: number, z: number, a: PlanPoint, b: PlanPoint): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = dx * dx + dz * dz
  const along = length === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / length))
  return hypot(x - (a.x + along * dx), z - (a.z + along * dz))
}

/** The distance between the segment a→b and the closed rectangle; 0 when they meet. */
function segmentToRect(a: PlanPoint, b: PlanPoint, l: number, t: number, r: number, bottom: number): number {
  if (crossesInterior(a, b, l, t, r, bottom)) return 0
  return Math.min(
    pointToRect(a.x, a.z, l, t, r, bottom),
    pointToRect(b.x, b.z, l, t, r, bottom),
    pointToSegment(l, t, a, b),
    pointToSegment(r, t, a, b),
    pointToSegment(l, bottom, a, b),
    pointToSegment(r, bottom, a, b),
  )
}

/**
 * The wall test for a grid: whether the plan segment a→b passes through a solid cell, or within `margin` metres of one
 * (with no margin, touching a cell's edge is not passing through it). Nothing outside the grid is solid.
 */
export function cellWalls(
  rows: readonly (readonly number[])[],
  cell: number,
  solid: readonly number[],
): (a: PlanPoint, b: PlanPoint, margin: number) => boolean {
  const isSolid = new Set(solid)
  return (a, b, margin) => {
    const reach = Math.max(margin, 0)
    const firstRow = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach) / cell))
    const lastRow = Math.min(rows.length - 1, Math.floor((Math.max(a.z, b.z) + reach) / cell))
    for (let row = firstRow; row <= lastRow; row++) {
      const cells = rows[row] as readonly number[]
      const firstCol = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach) / cell))
      const lastCol = Math.min(cells.length - 1, Math.floor((Math.max(a.x, b.x) + reach) / cell))
      for (let col = firstCol; col <= lastCol; col++) {
        if (!isSolid.has(cells[col] as number)) continue
        const [l, t, r, bottom] = [col * cell, row * cell, (col + 1) * cell, (row + 1) * cell]
        const hit =
          margin > 0 ? segmentToRect(a, b, l, t, r, bottom) < margin : crossesInterior(a, b, l, t, r, bottom)
        if (hit) return true
      }
    }
    return false
  }
}
