// What a wall-mounted piece hangs on: the wall it is against, found by where its back stands. A frame, a pinboard, a
// radiator and a vent are thin boxes 0.01 m off their wall; the wall is a single-sided face that is culled when the camera
// is behind it, but the box's back is geometry and would draw, lit by ambient alone as a flat dark slab. Linking the piece
// to its wall lets the occluder rule hide it with the wall.
import type { MeshData } from '../../shared/math/geometry.ts'
import type { WorldPiece } from './build.ts'

/** How far in front of a wall (metres) a piece's nearest point may stand and still hang on it: the kit hangs one 0.01 m off. */
const REACH = 0.06
/** How far behind the wall's face (metres) a piece may reach at most: a sign's panel is let into the plaster. */
const SUNK = 0.02

/**
 * The wall piece of `sector` that `mesh` is hung on, if any: the one whose face the mesh touches or stands nearest to, on
 * the room's side of it, within reach, and whose run along the plan the mesh's middle is over. A mesh that is not against
 * a wall is on none.
 */
export function wallOfMounted(
  mesh: MeshData,
  sector: string,
  pieces: readonly WorldPiece[],
): WorldPiece | undefined {
  const p = mesh.positions
  let [cx, cz, n] = [0, 0, 0]
  for (let i = 0; i < p.length; i += 3) {
    cx += p[i] as number
    cz += p[i + 2] as number
    n++
  }
  if (n === 0) return undefined
  ;[cx, cz] = [cx / n, cz / n]
  let best: WorldPiece | undefined
  let nearest = Number.POSITIVE_INFINITY
  for (const wall of pieces) {
    if (wall.part !== 'wall' || wall.line === undefined || wall.sector !== sector) continue
    const { a, b } = wall.line
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length <= 0) continue
    const [ux, uz] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length]
    const along = ((cx - a[0]) * ux + (cz - a[1]) * uz) / length
    if (along < 0 || along > 1) continue
    // How far the mesh's points stand in front of the face: the room is on the line's left, so a point's distance on that
    // side is positive. The mesh's nearest and farthest points bound the gap.
    let [low, high] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    for (let i = 0; i < p.length; i += 3) {
      const front = ((p[i + 2] as number) - a[1]) * ux - ((p[i] as number) - a[0]) * uz
      low = Math.min(low, front)
      high = Math.max(high, front)
    }
    if (low > REACH || high < -SUNK) continue
    const gap = low <= 0 ? 0 : low
    if (gap < nearest) [best, nearest] = [wall, gap]
  }
  return best
}
