// The occluder rule's geometry (M3 spec §4.2), plain arithmetic in metres with +y up. A wall is a span `a → b` on the
// floor plan with its inside face on that line and the room on its left (the inward normal is `(−dir.z, dir.x)`, as
// The Last Light's sectors, `src/game/sectors.ts` line 76 at 92e6704, and the 3D editor's `facesEye`).
//
// Two tests decide a wall: the facing test of §4.2 (the camera is on the wall's outer side), and the crossing test
// from The Last Light's 2.5D cut-away (`src/game/cutaway.ts` `wallHidden` at 92e6704): the camera's line to the
// player crosses the wall's face within its span, a figure's reach past either end, and below its top. The second
// matters across a doorway, where the eye stands in the next room and that room's copy of the partition faces it.

import type { Occlude } from '@automataframework/automata-sector-format'
import type { Vec3 } from '../camera/camera-pose.js'

export interface PlanPoint {
  readonly x: number
  readonly z: number
}

/**
 * A wall: its inside face from `a` to `b` on the floor plan, the room on its left, standing `height` metres from y 0,
 * and solid `thickness` metres outward (0 when omitted: a face with no depth).
 */
export interface WallSpan {
  readonly a: PlanPoint
  readonly b: PlanPoint
  readonly height: number
  readonly thickness?: number | undefined
}

/** An axis-aligned box in world metres: the camera view's `bounds` shape. */
export interface Box3 {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

/** Metres past a wall's end within which it still hides a figure behind it (The Last Light: half a sprite and some). */
export const FIGURE_REACH = 0.6
/**
 * A line ending this close to a wall's inside face, or within the wall's thickness and this far past its outside
 * face, ends in the wall's doorway, not behind it (The Last Light's 0.12 m, measured there on walls with no depth):
 * the player walking through a corridor mouth does not cut the wall either side of it.
 */
export const ON_THE_LINE = 0.12
/** Props taller than this fade by default; shorter ones never go (§4.2). */
export const TALL_PROP_METRES = 1.5

interface Span {
  readonly length: number
  readonly dir: PlanPoint
}

// A wall's length and direction, worked out once per wall: the rule asks for them several times a frame.
const spans = new WeakMap<WallSpan, Span>()

function spanOf(wall: WallSpan): Span {
  let span = spans.get(wall)
  if (span === undefined) {
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    const length = Math.hypot(dx, dz)
    if (!(length > 0))
      throw new Error(`occluders: a wall's a and b are the same point (${wall.a.x}, ${wall.a.z})`)
    span = { length, dir: { x: dx / length, z: dz / length } }
    spans.set(wall, span)
  }
  return span
}

/** Metres from the wall's inside face to `point`, positive on the room's side. */
export function wallSide(wall: WallSpan, point: Vec3): number {
  const { dir } = spanOf(wall)
  return (point.x - wall.a.x) * -dir.z + (point.z - wall.a.z) * dir.x
}

/** The facing test (§4.2): the wall's inside face points away from `eye`, which is on its outer side or edge-on. */
export const wallFacesAway = (wall: WallSpan, eye: Vec3): boolean => wallSide(wall, eye) <= 0

/** `point` in the wall's own frame: x along it from `a`, y up, z outward from its inside face. */
export function wallLocal(wall: WallSpan, point: Vec3): Vec3 {
  const { dir } = spanOf(wall)
  const [dx, dz] = [point.x - wall.a.x, point.z - wall.a.z]
  return { x: dx * dir.x + dz * dir.z, y: point.y, z: -(dx * -dir.z + dz * dir.x) }
}

/**
 * Whether the segment `from → to` runs from one side of the wall's inside face to the other through the wall's solid,
 * lengthened by `FIGURE_REACH` at each end. Through the solid, not only the face: a line can pass over the face's top
 * edge and come down through the wall's thickness. A line ending within `ON_THE_LINE` of the inside face, or in the
 * wall's depth up to `ON_THE_LINE` past its outside face, ends in a doorway.
 */
export function lineCrossesWall(wall: WallSpan, from: Vec3, to: Vec3): boolean {
  const start = wallSide(wall, from)
  const end = wallSide(wall, to)
  const thickness = wall.thickness ?? 0
  if (start * end >= 0 || (end < ON_THE_LINE && end > -thickness - ON_THE_LINE)) return false
  const { length, dir } = spanOf(wall)
  // Both ends in the wall's own frame (as `wallLocal`, without allocating: this runs for every wall every frame).
  const [fx, fz] = [from.x - wall.a.x, from.z - wall.a.z]
  const [tx, tz] = [to.x - wall.a.x, to.z - wall.a.z]
  return slabsHit(
    fx * dir.x + fz * dir.z,
    from.y,
    -start,
    tx * dir.x + tz * dir.z,
    to.y,
    -end,
    -FIGURE_REACH,
    0,
    0,
    length + FIGURE_REACH,
    wall.height,
    thickness,
  )
}

/** Whether the segment `from → to` passes through `box` (slabs; touching a face counts). */
export const segmentHitsBox = (from: Vec3, to: Vec3, box: Box3): boolean =>
  slabsHit(
    from.x,
    from.y,
    from.z,
    to.x,
    to.y,
    to.z,
    box.min[0],
    box.min[1],
    box.min[2],
    box.max[0],
    box.max[1],
    box.max[2],
  )

/** The slab test on plain numbers: the segment (x0, y0, z0) → (x1, y1, z1) against the box (lx, ly, lz)–(hx, hy, hz). */
function slabsHit(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  lx: number,
  ly: number,
  lz: number,
  hx: number,
  hy: number,
  hz: number,
): boolean {
  enter = 0
  leave = 1
  return clip(x0, x1 - x0, lx, hx) && clip(y0, y1 - y0, ly, hy) && clip(z0, z1 - z0, lz, hz)
}

// The segment's parameter range inside the slabs so far; module state so the test allocates nothing.
let enter = 0
let leave = 1

/** Narrows `enter..leave` to one axis's slab; false once the range is empty. */
function clip(origin: number, step: number, low: number, high: number): boolean {
  if (step === 0) return origin >= low && origin <= high
  const t0 = (low - origin) / step
  const t1 = (high - origin) / step
  enter = Math.max(enter, Math.min(t0, t1))
  leave = Math.min(leave, Math.max(t0, t1))
  return enter <= leave
}

/** What a prop does on the line: what it says, else `fade` when taller than 1.5 m and `never` when not (§4.2). */
export function propOcclude(bounds: Box3, given: Occlude | undefined): Occlude {
  if (given !== undefined) return given
  return bounds.max[1] - bounds.min[1] > TALL_PROP_METRES ? 'fade' : 'never'
}
