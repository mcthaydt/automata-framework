// D3-g's check: an authored view keeps the focus point and the room's floor outline inside the
// frame at the narrowest and widest screens the runtime letterboxes to, 4:3 and 21:9, whichever way the player turns
// the camera. The vertical field is fixed (24 mm, 53.13°), so a wider screen only shows more to the sides. The player
// stands at `at` (the outline's centre by default) and the camera is placed as the rig places it, by the occluder
// `framedFocus` and `eyeOf`. The focus checked is the player's own (`focusHeight` above `at`), not the camera's look
// point, which the view's bounds may hold elsewhere. A point at or behind the eye is outside whatever its projected x and y say.
import { eyeOf, framedFocus, projectToNdc, type Vec3 } from '../camera-pose.ts'
import { fovOf, LENS_MM } from '../fov.ts'
import type { CameraView } from '../sim/camera-view.schema.ts'
import type { PlanPoint } from './occluder-rule.ts'

export interface FramingInput {
  readonly view: CameraView
  /** The room's floor outline, at y 0. */
  readonly outline: readonly PlanPoint[]
  /** Where the player stands. Default: the middle of the outline's extent, on the floor. */
  readonly at?: Vec3 | undefined
  /** Default 4:3 and 21:9. */
  readonly aspects?: readonly number[] | undefined
  /** Default 15. */
  readonly stepDeg?: number | undefined
}

export interface FramingMiss {
  readonly headingDeg: number
  readonly aspect: number
  /** `focus`, or the index of the outline corner outside the frame. */
  readonly point: 'focus' | number
}

const inFrame = (ndc: { x: number; y: number; depth: number }): boolean =>
  ndc.depth > 0 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1

function centreOf(outline: readonly PlanPoint[]): Vec3 {
  const xs = outline.map((p) => p.x)
  const zs = outline.map((p) => p.z)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: 0, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}

/** Every heading and aspect at which the focus or a corner of the outline falls outside the frame, in that order. */
export function framingMisses(input: FramingInput): FramingMiss[] {
  const { view, outline } = input
  const at = input.at ?? centreOf(outline)
  const aspects = input.aspects ?? [4 / 3, 21 / 9]
  const step = input.stepDeg ?? 15
  const fov = fovOf(LENS_MM)
  const misses: FramingMiss[] = []
  for (let headingDeg = 0; headingDeg < 360; headingDeg += step)
    for (const aspect of aspects) {
      const look = framedFocus({ player: at, lock: undefined, view, headingDeg, aspect })
      const eye = eyeOf(look, headingDeg, view.tiltDeg, view.distance)
      // The player's own focus, unclamped: the view's bounds may hold the camera's look point away from it.
      const focus = { x: at.x, y: at.y + view.focusHeight, z: at.z }
      if (!inFrame(projectToNdc(focus, eye, look, fov, aspect)))
        misses.push({ headingDeg, aspect, point: 'focus' })
      outline.forEach((corner, point) => {
        const ndc = projectToNdc({ x: corner.x, y: 0, z: corner.z }, eye, look, fov, aspect)
        if (!inFrame(ndc)) misses.push({ headingDeg, aspect, point })
      })
    }
  return misses
}
