import { type DrawingCamera, PLAYER_HEIGHT } from '@automata/3d'

// What a cutscene's shot keeps in sight, for the occluder rule (`DrawingCamera.subject`): the figure it frames, or nobody. By default
// the rule keeps a figure under the shot's look point in sight; for an insert of a thing on a wall that point is in the wall, so the
// rule cut the wall and the thing on it. Pure, so the choice is tested in Node.

type V3 = { readonly x: number; readonly y: number; readonly z: number }

/** A figure as the cutscene last placed it: where its feet are, and how far it is faded in (0 is gone). */
export interface PlacedFigure extends V3 {
  readonly alpha: number
}

/** A cutscene's shot: the eye, the point looked at, and the focal length in mm on the 24 mm gate. */
export interface Shot {
  readonly eye: V3
  readonly look: V3
  readonly lens: number
}

/** The frame's width over its height: the game's 4:3 field. A 16:9 field shows more at the sides, so a figure in 4:3 is in it too. */
const ASPECT = 4 / 3

/**
 * The figure the shot frames: of those shown, any of whose feet, middle or head is inside the frame, the one whose middle is nearest
 * its centre; `null` when none is (an insert), so the occluder rule takes nothing away.
 */
export function shotSubject(
  shot: Shot,
  figures: readonly PlacedFigure[],
): NonNullable<DrawingCamera['subject']> | null {
  const f = unit(sub(shot.look, shot.eye))
  const right = unit({ x: -f.z, y: 0, z: f.x })
  const up = {
    x: right.y * f.z - right.z * f.y,
    y: right.z * f.x - right.x * f.z,
    z: right.x * f.y - right.y * f.x,
  }
  // Half the frame's height at a metre's depth: the gate's 12 mm over the lens.
  const half = 12 / shot.lens
  /** Where `p` lands in the frame, -1 to 1 across and up, or undefined behind the eye. */
  const frameOf = (p: V3): { u: number; v: number } | undefined => {
    const q = sub(p, shot.eye)
    const depth = dot(q, f)
    if (depth < 0.1) return undefined
    return { u: dot(q, right) / depth / (half * ASPECT), v: dot(q, up) / depth / half }
  }
  let best: { feet: V3; head: V3 } | null = null
  let nearest = Number.POSITIVE_INFINITY
  for (const figure of figures) {
    if (!(figure.alpha > 0)) continue
    const feet = { x: figure.x, y: figure.y, z: figure.z }
    const head = { x: figure.x, y: figure.y + PLAYER_HEIGHT, z: figure.z }
    const points = [feet, { ...feet, y: figure.y + PLAYER_HEIGHT / 2 }, head].map(frameOf)
    if (!points.some((p) => p !== undefined && Math.abs(p.u) <= 1 && Math.abs(p.v) <= 1)) continue
    const middle = points[1]
    const off = middle === undefined ? Number.POSITIVE_INFINITY : Math.hypot(middle.u, middle.v)
    if (best === null || off < nearest) {
      best = { feet, head }
      nearest = off
    }
  }
  return best
}

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z
function unit(a: V3): V3 {
  const n = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / n, y: a.y / n, z: a.z / n }
}
