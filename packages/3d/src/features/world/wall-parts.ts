// The pieces of the world builder that read one wall: its trim, its openings, the room's side of it, its cornice and a facade's
// grid of windows. `build.ts` puts them together; none of them knows about the room around the wall.

import { createRng } from '@automata/sim'
import type {
  AfSectorEntry2,
  AfWall2,
  Band,
  Decor,
  Surface,
  WindowGrid,
} from '../../shared/level/af-sector-2.schema.ts'
import type { PartialTrim } from '../../shared/level/sector.schema.ts'
import type { MeshData } from '../../shared/math/geometry.ts'
import { wallQuad } from './plane-mesh.ts'
import type { Segment, V2 } from './sectors.ts'
import { isSurfaceTex } from './surface.ts'

/** The first-person default a wall's trim is painted with when it names no surface. */
const TRIM = 'trimWhite'

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u
export const offset = (p: V2, n: V2, d: number): V2 => [p[0] + n[0] * d, p[1] + n[1] * d]

/** A wall's trim heights and surface, from `trim` (heights or a surface), the sector's trim and the wall's own. */
export function trimOf(
  sector: AfSectorEntry2,
  wall: AfWall2,
): { surface: Surface; skirting: number; rail: number } {
  const trim = wall.trim
  const heights: PartialTrim | undefined =
    trim === undefined || typeof trim === 'string' || isSurfaceTex(trim) ? undefined : trim
  return {
    surface: trim !== undefined && heights === undefined ? (trim as Surface) : TRIM,
    skirting: wall.skirting ?? heights?.skirting ?? sector.trim?.skirting ?? 0,
    rail: wall.rail ?? heights?.rail ?? sector.trim?.rail ?? 0,
  }
}

/** An opening in a wall's face: along the segment (0 to 1) and up from the floor (metres). */
export interface Opening {
  readonly u0: number
  readonly u1: number
  readonly y0: number
  readonly y1: number
  readonly kind: 'door' | 'window'
  readonly bars?: number
}

/** The segment as the occluder rule reads a wall: from `a` to `b` with the room on the left. */
export function roomOnLeft(seg: Segment, n: V2): { a: V2; b: V2 } {
  const left: V2 = [-(seg.b[1] - seg.a[1]), seg.b[0] - seg.a[0]]
  return left[0] * n[0] + left[1] * n[1] > 0 ? { a: seg.a, b: seg.b } : { a: seg.b, b: seg.a }
}

/** The coordinate along the dominant axis at `u` of the segment. */
export const along2 = (seg: Segment, axis: 0 | 1, u: number): number => lerp(seg.a[axis], seg.b[axis], u)

/** The cornice: a band under the ceiling, in its own surface; it is not broken at doors and windows. */
export function corniceOf(band: Band, seg: Segment, n: V2, ceilings: readonly [number, number]): MeshData {
  return wallQuad(
    offset(seg.a, n, 0.025),
    offset(seg.b, n, 0.025),
    [ceilings[0] - band.height, ceilings[0]],
    [ceilings[1] - band.height, ceilings[1]],
    n,
  )
}

/** A facade's grid of windows as decor, lit by a seeded share at night. */
export function windowsOf(grid: WindowGrid, seg: Segment, night: boolean, horizontal: boolean): Decor[] {
  const rng = createRng(grid.seed ?? seg.sector * 31 + seg.edge)
  const out: Decor[] = []
  for (let row = 0; row < grid.rows; row++)
    for (let col = 0; col < grid.cols; col++) {
      const t = (col + 0.5) / grid.cols
      const pos = horizontal ? lerp(seg.a[0], seg.b[0], t) : lerp(seg.a[1], seg.b[1], t)
      const lit = night && rng.next() < (grid.lit ?? 0.5)
      out.push({
        kind: 'window',
        pos,
        width: grid.width,
        height: grid.height,
        sill: grid.from + row * (grid.height + grid.gap),
        lit,
        ...(grid.frame === undefined ? {} : { frame: grid.frame }),
        ...(lit && grid.glassLit !== undefined
          ? { glass: grid.glassLit }
          : grid.glass === undefined || lit
            ? {}
            : { glass: grid.glass }),
        seed: Math.floor(rng.next() * 1e6),
      })
    }
  return out
}
