// The angled camera (M3 spec §4.2): the Owner's 24 mm lens, 25° down and 5 m back by default, following the player
// with eased lag inside the active view's bounds and turned by the sim's heading. Presentation only (law 1): it reads
// interpolated positions and the sim's heading and writes only the `Camera3D` it is given.
//
// Two eases, both cuts under reduced motion: a view activated with `ease` blends the eye and the look point from where
// they were to the new view's live pose over 400 ms; a heading set with `ease` (a view entry that sets `yawDeg`) turns
// the shorter way over 250 ms. A tracked heading (the player's turn) shows in the same frame; a turn that arrives
// while a view entry's heading is still easing in moves the ease's end by the same amount, so the camera does not
// snap. Reduced motion also makes the follow's lag instant (spec §8).
//
// Nothing is seeded before the first `follow`: the renderer draws frames before the player's row exists, and a
// focus remembered from the origin would make the first view swoop in from there.
import { reducedMotion as prefersReducedMotion } from '@mcthaydt/automata-ui'
import type { Camera3D } from '@pixi/3d'
import type { CameraView } from '../sim/camera-view.schema.js'
import { eyeOf, framedFocus, lerp3, shorterArc, smoothstep, type Vec3 } from './camera-pose.js'
import { fovOf, LENS_MM } from './fov.js'

/** How long `activate(id, 'ease')` blends, in seconds. */
export const VIEW_EASE_SECONDS = 0.4
/** How long `heading(yaw, 'ease')` turns, in seconds. */
export const HEADING_EASE_SECONDS = 0.25
// Frame times are summed floats: an ease ends when its elapsed time is within this of its length.
const EPSILON = 1e-9

export interface CameraRig {
  /** 24 (Owner, 2026-10-23), in every view. */
  readonly lensMm: number
  setViews(views: readonly CameraView[]): void
  /** The view `id` among the rig's views, if any. */
  viewOf(id: string): CameraView | undefined
  /**
   * Makes `id` the active view: `ease` blends over 400 ms (a cut under reduced motion); `cut` snaps to the followed
   * position, even into the view already active (a new sim, a resync). An unknown id warns once.
   */
  activate(id: string, how: 'cut' | 'ease'): void
  /** The sim's heading in degrees: `track` (the default) shows it this frame, `ease` turns to it over 250 ms. */
  heading(yawDeg: number, how?: 'track' | 'ease'): void
  /** The followed position, interpolated: the player's feet. The first call snaps the focus to it. */
  follow(x: number, y: number, z: number): void
  /** Lock-on: lean the focus toward the target (up to 35%, inside the bounds and the middle third); none clears it. */
  frame(lock?: Vec3): void
  /** Advances one display frame and writes the camera. */
  update(frameSeconds: number): void
  /**
   * What the last `update` wrote: the eye, the point it looked at, the followed position (the player's feet) and
   * whether it was a cut, for the occluder rule. None before the first `follow`. The record is the rig's own and is
   * rewritten by the next `update` (no allocation per frame).
   */
  pose(): CameraPose | undefined
}

export interface CameraPose {
  readonly eye: Vec3
  readonly look: Vec3
  readonly player: Vec3
  /** Whether this frame snapped rather than moved on from the last: the first follow, or the first after a cut. */
  readonly cut: boolean
}

export interface AngledCameraOptions {
  /** The `View3D`'s camera: the only thing the rig writes. */
  readonly camera: Camera3D
  readonly views: readonly CameraView[]
  /** The view to start in; it must be one of `views`. */
  readonly initial: string
  /** The frame's width over its height, for lock-on's middle third. Default 16:9. */
  readonly aspect?: (() => number) | undefined
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: (() => boolean) | undefined
  /** Where a run-time problem is reported (an unknown view id, once per id). Default `console.warn`. */
  readonly warn?: ((message: string) => void) | undefined
}

interface Blend {
  readonly fromEye: Vec3
  readonly fromLook: Vec3
  elapsed: number
}

interface HeadingEase {
  readonly from: number
  turn: number
  elapsed: number
}

const byId = (views: readonly CameraView[]): Map<string, CameraView> => new Map(views.map((v) => [v.id, v]))

export function angledCamera(options: AngledCameraOptions): CameraRig {
  const { camera } = options
  const aspect = options.aspect ?? (() => 16 / 9)
  const isReduced = options.reducedMotion ?? (() => prefersReducedMotion())
  const warn = options.warn ?? ((message: string) => console.warn(`[automata-render-pixi3d] ${message}`))
  const fov = fovOf(LENS_MM)

  let views = byId(options.views)
  let active = views.get(options.initial)
  if (active === undefined)
    throw new Error(`angledCamera: the initial view "${options.initial}" is not among the views`)
  const warned = new Set<string>()

  let followed: Vec3 | undefined
  let focus: Vec3 | undefined
  let lock: Vec3 | undefined
  let shownHeading = 0
  let targetHeading = 0
  let headingEase: HeadingEase | undefined
  let blend: Blend | undefined
  let last: { eye: Vec3; look: Vec3; player: Vec3; cut: boolean } | undefined

  const stepHeading = (seconds: number, reduced: boolean): void => {
    if (headingEase === undefined) return
    headingEase.elapsed += seconds
    if (reduced || headingEase.elapsed >= HEADING_EASE_SECONDS - EPSILON) {
      shownHeading = targetHeading
      headingEase = undefined
      return
    }
    shownHeading =
      headingEase.from + headingEase.turn * smoothstep(headingEase.elapsed / HEADING_EASE_SECONDS)
  }

  const stepFocus = (view: CameraView, player: Vec3, seconds: number, reduced: boolean): Vec3 => {
    const wanted = framedFocus({ player, lock, view, headingDeg: shownHeading, aspect: aspect() })
    if (focus === undefined || view.lag <= 0 || reduced) return wanted
    // Exponential approach with time constant `lag`: frame-rate independent, never overshoots.
    return lerp3(focus, wanted, 1 - Math.exp(-seconds / view.lag))
  }

  return {
    lensMm: LENS_MM,
    setViews(next) {
      views = byId(next)
      if (active !== undefined) active = views.get(active.id) ?? active
    },
    viewOf: (id) => views.get(id),
    activate(id, how) {
      const view = views.get(id)
      if (view === undefined) {
        if (!warned.has(id)) {
          warned.add(id)
          warn(`no camera view "${id}": the camera keeps "${active?.id}"`)
        }
        return
      }
      const easing = how === 'ease' && last !== undefined && !isReduced()
      if (view === active && easing) return
      active = view
      if (easing && last !== undefined) {
        blend = { fromEye: last.eye, fromLook: last.look, elapsed: 0 }
      } else {
        blend = undefined
        focus = undefined
      }
    },
    heading(yawDeg, how = 'track') {
      if (how === 'track') {
        // The renderer tracks every frame: the same target an ease is turning to lets it finish, and a player's turn
        // during the ease moves its end by that turn instead of snapping the camera there.
        if (headingEase !== undefined) {
          headingEase.turn += shorterArc(targetHeading, yawDeg)
          targetHeading = yawDeg
          return
        }
        shownHeading = targetHeading = yawDeg
        headingEase = undefined
        return
      }
      targetHeading = yawDeg
      headingEase = { from: shownHeading, turn: shorterArc(shownHeading, yawDeg), elapsed: 0 }
      if (isReduced()) stepHeading(0, true)
    },
    follow(x, y, z) {
      followed = { x, y, z }
    },
    frame(target) {
      lock = target
    },
    update(frameSeconds) {
      const view = active as CameraView
      const reduced = isReduced()
      stepHeading(frameSeconds, reduced)
      const player = followed ?? { x: 0, y: 0, z: 0 }
      // No focus kept (the first follow, or a cut cleared it): this frame snaps.
      const cut = focus === undefined
      const shown = stepFocus(view, player, frameSeconds, reduced)
      if (followed !== undefined) focus = shown
      let eye = eyeOf(shown, shownHeading, view.tiltDeg, view.distance)
      let look = shown
      if (blend !== undefined) {
        blend.elapsed += frameSeconds
        if (reduced || blend.elapsed >= VIEW_EASE_SECONDS - EPSILON) blend = undefined
        else {
          const t = smoothstep(blend.elapsed / VIEW_EASE_SECONDS)
          eye = lerp3(blend.fromEye, eye, t)
          look = lerp3(blend.fromLook, look, t)
        }
      }
      // A blend starts only from a pose that framed the player, never from the frames before the first follow.
      if (followed !== undefined) {
        if (last === undefined) last = { eye, look, player: followed, cut }
        else {
          last.eye = eye
          last.look = look
          last.player = followed
          last.cut = cut
        }
      }
      camera.fov = fov
      camera.position.set(eye.x, eye.y, eye.z)
      camera.lookAt(look)
    },
    pose: () => last,
  }
}
