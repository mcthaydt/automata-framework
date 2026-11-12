// The occluder rule per frame, apart from Pixi so it is plain state to test. Each frame it takes the
// camera's eye and look point and the player's feet and head, and says for each registered wall and prop whether the
// rule takes it out of the way and how far its fade has got.
//
// Walls: a wall is occluding when the eye faces its outside or the eye's line to any point of the figure crosses it
// (`occluder-rule.ts`): five heights up it (feet, knee, waist, chest, head), and, given the sprite's half width, those moved that
// far to either side across the view, so what the frame shows of the figure is what is kept clear, not only a line down its middle. Hysteresis errs toward cutting: a standing wall goes the moment it occludes, and a cut wall
// comes back only when it would stay clear with the eye turned 5° either way about the look point. So no wall stands
// while the eye is outside it (D3-h holds in every frame), and turning back and forth across the edge does not
// flicker it. Props: one whose bounds the line to any of those points crosses is occluding; it is clear the frame
// it is not.
//
// Every change is one 150 ms fade, linear in a 0-to-1 progress, both ways: opacity is `1 − progress × (1 − floor)`,
// with floor 0 for `cut` and 0.25 for `fade`. Reduced motion jumps, and so does the first step and the first
// after `reset`: nothing was drawn to fade from, so a wall must not flash in front of the player. A `cut` wall's trim shows while the wall is
// not fully shown, so the room's outline reads.

import type { Occlude } from '../../../shared/level/occlude.ts'
import type { Vec3 } from '../camera-pose.ts'
import { type Box3, lineCrossesWall, segmentHitsBox, type WallSpan, wallFacesAway } from './occluder-rule.ts'

/** A faded mesh's opacity, as the editor's `fade` surface. */
export const FADED_OPACITY = 0.25
/** How long a cut or a fade takes, either way. */
export const OCCLUDER_FADE_SECONDS = 0.15
/** Degrees of camera turn a cut wall must clear, either way, before it comes back. */
export const HYSTERESIS_DEG = 5

export interface WallEntry {
  readonly span: WallSpan
  readonly occlude: Occlude
}

export interface PropEntry {
  /** World bounds, metres. */
  readonly bounds: Box3
  readonly occlude: Occlude
}

/** One display frame: where the camera is and looks, where the player is, how long the frame was. */
export interface OccluderFrame {
  readonly eye: Vec3
  readonly look: Vec3
  readonly feet: Vec3
  readonly head: Vec3
  /**
   * Half the figure's width as drawn, in metres across the view (0 when omitted: the lines run to its middle only). A whole-pixel
   * sprite is wider than the figure's body, and the frame shows all of it.
   */
  readonly width?: number | undefined
  readonly seconds: number
  readonly reduced: boolean
}

export interface WallShown {
  /** Whether the rule takes the wall out of the way this frame. */
  occluded: boolean
  /** 1 drawn as authored, 0 gone. */
  opacity: number
  /** Whether its floor trim shows. */
  trim: boolean
}

export interface OccluderShown {
  readonly walls: readonly WallShown[]
  /** Each prop's opacity. */
  readonly props: readonly number[]
}

export interface OccluderPass {
  /**
   * One frame of the rule. The arrays and records it returns are the pass's own and are rewritten by the next step
   * (no allocation per frame): read them before stepping again.
   */
  step(frame: OccluderFrame): OccluderShown
  /** The next step jumps to where the rule says, with no fade: a resync, a rebuilt renderer, a camera cut. */
  reset(): void
}

const floorOf = (occlude: Occlude): number => (occlude === 'fade' ? FADED_OPACITY : 0)

// The eye turned for the hysteresis test, rewritten each time (no allocation per frame).
const turnedEye = { x: 0, y: 0, z: 0 }

/** `eye` turned `deg` about the vertical line through `look`, into `turnedEye`. */
function turned(eye: Vec3, look: Vec3, deg: number): Vec3 {
  const angle = (deg * Math.PI) / 180
  const dx = eye.x - look.x
  const dz = eye.z - look.z
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  turnedEye.x = look.x + dx * cos + dz * sin
  turnedEye.y = eye.y
  turnedEye.z = look.z - dx * sin + dz * cos
  return turnedEye
}

/** The points of the figure the rule keeps in sight, rewritten each frame (no allocation per frame). */
const body: { x: number; y: number; z: number }[] = Array.from({ length: 15 }, () => ({ x: 0, y: 0, z: 0 }))
/** The heights up the figure the lines run to, as shares of feet to head: close enough that a strip light cannot slip between. */
const ROWS = [0, 0.25, 0.5, 0.7, 1]

function put(i: number, x: number, y: number, z: number): void {
  const point = body[i] as { x: number; y: number; z: number }
  point.x = x
  point.y = y
  point.z = z
}

/**
 * Fills `body` with the figure's points for `frame` and says how many there are: the `ROWS` up it, then, with a width, each of
 * them moved that far to the eye's right and to its left (across the line from the eye to the look point, level).
 */
function bodyOf(frame: OccluderFrame): number {
  const { feet, head } = frame
  for (let row = 0; row < ROWS.length; row++) {
    const t = ROWS[row] as number
    put(row, feet.x + (head.x - feet.x) * t, feet.y + (head.y - feet.y) * t, feet.z + (head.z - feet.z) * t)
  }
  const width = frame.width ?? 0
  const fx = frame.look.x - frame.eye.x
  const fz = frame.look.z - frame.eye.z
  const level = Math.hypot(fx, fz)
  if (!(width > 0 && level > 0)) return ROWS.length
  // Looking along (fx, fz) with +y up, the right is (−fz, fx), as `forward × up` has it.
  const rx = (-fz / level) * width
  const rz = (fx / level) * width
  for (let row = 0; row < ROWS.length; row++) {
    const { x, y, z } = body[row] as Vec3
    put(ROWS.length + row, x + rx, y, z + rz)
    put(2 * ROWS.length + row, x - rx, y, z - rz)
  }
  return 3 * ROWS.length
}

function wallOccludes(span: WallSpan, eye: Vec3, points: number): boolean {
  if (wallFacesAway(span, eye)) return true
  for (let i = 0; i < points; i++) if (lineCrossesWall(span, eye, body[i] as Vec3)) return true
  return false
}

/** Whether `point` is inside `bounds` (on a face counts). */
const within = (point: Vec3, { min, max }: Box3): boolean =>
  point.x >= min[0] &&
  point.x <= max[0] &&
  point.y >= min[1] &&
  point.y <= max[1] &&
  point.z >= min[2] &&
  point.z <= max[2]

/**
 * Whether the line to any of the figure's points passes through `bounds`. A point inside the box is beside the prop, not behind it
 * (the figure standing against a cabinet, its sprite's side reaching into it), so its line does not count.
 */
function propOnLine(bounds: Box3, eye: Vec3, points: number): boolean {
  for (let i = 0; i < points; i++) {
    const point = body[i] as Vec3
    if (!within(point, bounds) && segmentHitsBox(eye, point, bounds)) return true
  }
  return false
}

/**
 * Moves `progress` toward `target` (0 or 1) at one whole fade per 150 ms, or at once under reduced motion or when
 * `snap` (the first step, or the first after a reset: nothing was drawn to fade from).
 */
function stepProgress(progress: number, target: number, frame: OccluderFrame, snap: boolean): number {
  if (frame.reduced || snap) return target
  const by = frame.seconds / OCCLUDER_FADE_SECONDS
  return target > progress ? Math.min(target, progress + by) : Math.max(target, progress - by)
}

export function occluderPass(entries: {
  readonly walls: readonly WallEntry[]
  readonly props: readonly PropEntry[]
}): OccluderPass {
  const walls = entries.walls.map((entry) => ({ entry, progress: 0 }))
  const props = entries.props.map((entry) => ({ entry, progress: 0 }))
  const shownWalls: WallShown[] = walls.map(() => ({ occluded: false, opacity: 1, trim: false }))
  const shownProps: number[] = props.map(() => 1)
  const shown: OccluderShown = { walls: shownWalls, props: shownProps }
  let snap = true
  return {
    step(frame) {
      const points = bodyOf(frame)
      walls.forEach((wall, i) => {
        const out = shownWalls[i] as WallShown
        const { span, occlude } = wall.entry
        if (occlude === 'never') return
        const was = out.occluded && !snap
        out.occluded =
          wallOccludes(span, frame.eye, points) ||
          (was &&
            (wallOccludes(span, turned(frame.eye, frame.look, HYSTERESIS_DEG), points) ||
              wallOccludes(span, turned(frame.eye, frame.look, -HYSTERESIS_DEG), points)))
        wall.progress = stepProgress(wall.progress, out.occluded ? 1 : 0, frame, snap)
        out.opacity = 1 - wall.progress * (1 - floorOf(occlude))
        out.trim = occlude === 'cut' && out.opacity < 1
      })
      props.forEach((prop, i) => {
        const { bounds, occlude } = prop.entry
        if (occlude === 'never') return
        const on = propOnLine(bounds, frame.eye, points)
        prop.progress = stepProgress(prop.progress, on ? 1 : 0, frame, snap)
        shownProps[i] = 1 - prop.progress * (1 - floorOf(occlude))
      })
      snap = false
      return shown
    },
    reset() {
      snap = true
    },
  }
}
