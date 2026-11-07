// A rule Last Light has only as a test ("sectors do not overlap", tests/scenes.test.ts): no point of the plan is in
// two sectors. Two sectors overlap when some stretch of one's wall has the other's inside just behind it.
//
// Each wall of one sector is cut where the other's walls meet it (crossings, corners resting on it, the ends of a shared
// stretch); the middle of every piece is then either wholly in the other sector or wholly out of it, so a probe a hair
// inside the room answers for the piece. That reads touching, nested, identical, holed and concave sectors alike, and
// walls that share a line: a wall of a room next door has the room on the other side of it.
import type { Point } from '@automata/3d/level'
import { type Edge, insideSector, type Sector } from '../geometry/sectors'
import { formatPoint, type GeometryContext, type Problem, sectorSelection } from './check'

/** Pieces of wall shorter than this are not probed. */
const SLIVER = 1e-3
/** How far inside the room a piece's probe is put. */
const PROBE = 1e-4
/** A crossing this far outside either wall, in parts of its length, still counts as a touch (rounding). */
const TOUCH = 1e-9

const cross = (ax: number, az: number, bx: number, bz: number): number => ax * bz - az * bx

/** Where along `edge` (0 at its start, 1 at its end) the wall c→d meets it: a crossing, a touch, or the ends of a shared stretch. */
function meetings(edge: Edge, c: Point, d: Point): number[] {
  const rx = edge.b.x - edge.a.x
  const rz = edge.b.z - edge.a.z
  const sx = d.x - c.x
  const sz = d.z - c.z
  const denominator = cross(rx, rz, sx, sz)
  const toStart = { x: c.x - edge.a.x, z: c.z - edge.a.z }
  if (Math.abs(denominator) < 1e-12 * edge.length * Math.hypot(sx, sz)) {
    // Parallel: a wall on the same line meets it along the stretch they share, so cut at where that stretch's ends
    // fall. A wall off the line cuts it where it need not (the cut puts a piece into two of the same side): harmless.
    return [c, d].map((p) => ((p.x - edge.a.x) * rx + (p.z - edge.a.z) * rz) / (edge.length * edge.length))
  }
  const t = cross(toStart.x, toStart.z, sx, sz) / denominator
  const u = cross(toStart.x, toStart.z, rx, rz) / denominator
  return t >= -TOUCH && t <= 1 + TOUCH && u >= -TOUCH && u <= 1 + TOUCH ? [t] : []
}

/** A point just inside `sector`, behind a piece of its wall, that lies in `other` too; undefined when none does. */
function witness(sector: Sector, other: Sector): Point | undefined {
  const otherWalls = other.loops.flat()
  for (const edge of sector.loops.flat()) {
    const cuts = [0, 1, ...otherWalls.flatMap((wall) => meetings(edge, wall.a, wall.b))]
      .filter((t) => t >= 0 && t <= 1)
      .sort((p, q) => p - q)
    for (let i = 0; i + 1 < cuts.length; i++) {
      const [from, to] = [cuts[i] as number, cuts[i + 1] as number]
      if ((to - from) * edge.length < SLIVER) continue
      const middle = (from + to) / 2
      const probe = {
        x: edge.a.x + (edge.b.x - edge.a.x) * middle + edge.normal.x * PROBE,
        z: edge.a.z + (edge.b.z - edge.a.z) * middle + edge.normal.z * PROBE,
      }
      if (insideSector(probe, other)) return probe
    }
  }
  return undefined
}

export function overlapProblems(context: GeometryContext): Problem[] {
  const problems: Problem[] = []
  const { sectors } = context.map
  sectors.forEach((first, i) => {
    for (const second of sectors.slice(i + 1)) {
      const at = witness(first, second) ?? witness(second, first)
      if (at)
        problems.push({
          message: `${first.id} and ${second.id} overlap near (${formatPoint(at)})`,
          locator: { selection: sectorSelection(first.id), at },
          related: [{ selection: sectorSelection(second.id), at }],
        })
    }
  })
  return problems
}
