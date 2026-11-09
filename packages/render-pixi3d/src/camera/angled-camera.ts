// The angled camera (M3 spec §4.2) on klipp (`@pmndrs/klipp`, Owner 2026-10-30: "keep in mind for the camera we're
// using klipp"): the Owner's 24 mm lens, 25° down and 5 m back by default, following the player inside the active
// view's bounds and turned by the sim's heading. Presentation only (law 1): it reads interpolated positions and the
// sim's heading and writes only the `Camera3D` it is given.
//
// klipp does the camera: one `VirtualCamera` per `camera-view`, each an `OrbitFollowBody` on a sphere (radius the
// view's distance, `vertical` its tilt, `horizontal` 180° − the heading: klipp's 0 puts the eye at +z, ours looks
// toward +z) with the view's lag as its damping, aimed by `HardLookAtAim`. The active view has the top priority;
// `ease` blends easeInOut over 400 ms, `cut` and reduced motion cut. A heading set with `ease` moves the `horizontal`
// axis's target and klipp's axis damping turns the shorter way in about 250 ms; a tracked heading (the player's
// turn) jumps the axis, or moves the target of an ease still running, so the camera does not snap. Reduced motion
// zeroes every damping (spec §8). The one thin layer of our own is the target point, `framedFocus`: the follow
// raised by the view's focus height, leaned toward a lock-on and kept inside the view's bounds.
//
// Nothing runs before the first `follow`: the renderer draws frames before the player's row exists, and a pose
// from the origin would make the first view swoop in from there.
import { reducedMotion as prefersReducedMotion } from '@automataframework/automata'
import type { Camera3D } from '@pixi/3d'
import {
  BlendCurves,
  HardLookAtAim,
  inputAxis,
  Klipp,
  OrbitFollowBody,
  type TargetPose,
  targetPose,
  VirtualCamera,
} from '@pmndrs/klipp'
import type { CameraView } from '../sim/camera-view.schema.js'
import { framedFocus, shorterArc, type Vec3 } from './camera-pose.js'
import { fovOf, LENS_MM } from './fov.js'

/** How long `activate(id, 'ease')` blends, in seconds. */
export const VIEW_EASE_SECONDS = 0.4
/** About how long `heading(yaw, 'ease')` turns, in seconds: klipp's axis damping is within half a degree by then. */
export const HEADING_EASE_SECONDS = 0.25
// klipp's damping constant for the heading ease: measured to settle a half turn within 0.5° in 250 ms at 60 Hz.
const HEADING_DAMPING = 0.05
const EASE = { curve: BlendCurves.easeInOut, time: VIEW_EASE_SECONDS }
const CUT = { curve: BlendCurves.cut, time: 0 }

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

interface Shot {
  readonly view: CameraView
  readonly camera: VirtualCamera
  readonly body: OrbitFollowBody
}

/** klipp's `horizontal` for our heading, in its range [−180, 180]. */
const horizontalOf = (headingDeg: number): number => {
  const degrees = (((180 - headingDeg) % 360) + 360) % 360
  return degrees > 180 ? degrees - 360 : degrees
}

export function angledCamera(options: AngledCameraOptions): CameraRig {
  const { camera } = options
  const aspect = options.aspect ?? (() => 16 / 9)
  const isReduced = options.reducedMotion ?? (() => prefersReducedMotion())
  const warn = options.warn ?? ((message: string) => console.warn(`[automata-render-pixi3d] ${message}`))
  const fov = fovOf(LENS_MM)

  const klipp = new Klipp({ defaultBlend: CUT })
  // The one target every view's body follows and aims at: `framedFocus`, written each frame.
  const target: TargetPose = targetPose.create()
  const shots = new Map<string, Shot>()
  let active: Shot | undefined
  const warned = new Set<string>()

  let followed: Vec3 | undefined
  let lock: Vec3 | undefined
  let heading = 0
  let headingEasing = false
  // The next update snaps: the first after the first follow, or after a cut.
  let snapping = true
  let last: { eye: Vec3; look: Vec3; player: Vec3; cut: boolean } | undefined

  const shotFor = (view: CameraView): Shot => {
    const body = new OrbitFollowBody(target, {
      orbitStyle: 'sphere',
      radius: view.distance,
      bindingMode: 'worldSpace',
      damping: view.lag,
    })
    body.state.vertical.setValue(view.tiltDeg)
    body.state.horizontal.setValue(horizontalOf(heading))
    const made = new VirtualCamera(view.id, { priority: 0, initialState: { fov } })
    made.setBody(body)
    made.setAim(new HardLookAtAim(target))
    klipp.add(made)
    return { view, camera: made, body }
  }

  const setViews = (views: readonly CameraView[]): void => {
    const ids = new Set(views.map((view) => view.id))
    for (const [id, shot] of shots) {
      if (ids.has(id)) continue
      klipp.remove(shot.camera)
      shots.delete(id)
    }
    for (const view of views) {
      const shot = shots.get(view.id)
      if (shot === undefined) {
        shots.set(view.id, shotFor(view))
        continue
      }
      shot.body.radius = view.distance
      shot.body.state.vertical.setValue(view.tiltDeg)
      shots.set(view.id, { ...shot, view })
    }
    if (active !== undefined) active = shots.get(active.view.id) ?? active
  }

  setViews(options.views)
  active = shots.get(options.initial)
  if (active === undefined)
    throw new Error(`angledCamera: the initial view "${options.initial}" is not among the views`)
  active.camera.priority = 1

  /** Turns `shot`'s orbit to the heading: at once, or (an ease) by moving the axis's target. */
  const turn = (shot: Shot, easing: boolean): void => {
    const axis = shot.body.state.horizontal
    if (easing) inputAxis.applyDelta(axis, shorterArc(axis.rawValue, horizontalOf(heading)))
    else axis.setValue(horizontalOf(heading))
  }

  /** Starts `shot` afresh: klipp snaps a camera that turns active again onto its target. */
  const restart = (shot: Shot): void => {
    shot.camera.active = false
    shot.camera.active = true
  }

  return {
    lensMm: LENS_MM,
    setViews,
    viewOf: (id) => shots.get(id)?.view,
    activate(id, how) {
      const shot = shots.get(id)
      if (shot === undefined) {
        if (!warned.has(id)) {
          warned.add(id)
          warn(`no camera view "${id}": the camera keeps "${active?.view.id}"`)
        }
        return
      }
      const easing = how === 'ease' && followed !== undefined && !isReduced()
      if (shot === active && easing) return
      klipp.defaultBlend = easing ? EASE : CUT
      if (active !== undefined && active !== shot) active.camera.priority = 0
      active = shot
      shot.camera.priority = 1
      turn(shot, false)
      if (!easing) {
        restart(shot)
        snapping = true
      }
    },
    heading(yawDeg, how = 'track') {
      const shot = active as Shot
      const axis = shot.body.state.horizontal
      // An ease still running: a tracked turn moves its end by the same amount instead of snapping there.
      const stillEasing = headingEasing && Math.abs(shorterArc(axis.value, axis.rawValue)) > 1e-6
      const easing = (how === 'ease' || stillEasing) && !isReduced()
      heading = yawDeg
      headingEasing = easing
      turn(shot, easing)
    },
    follow(x, y, z) {
      followed = { x, y, z }
    },
    frame(next) {
      lock = next
    },
    update(frameSeconds) {
      if (followed === undefined) return
      const shot = active as Shot
      const reduced = isReduced()
      for (const { view, body } of shots.values()) {
        body.damping = reduced ? 0 : view.lag
        body.state.horizontal.damping = reduced ? 0 : HEADING_DAMPING
      }
      const focus = framedFocus({
        player: followed,
        lock,
        view: shot.view,
        headingDeg: heading,
        aspect: aspect(),
      })
      target.position[0] = focus.x
      target.position[1] = focus.y
      target.position[2] = focus.z
      klipp.update(frameSeconds)
      const { position, lookAtTarget } = klipp.shot
      const eye = { x: position[0], y: position[1], z: position[2] }
      const look = { x: lookAtTarget[0], y: lookAtTarget[1], z: lookAtTarget[2] }
      if (last === undefined) last = { eye, look, player: followed, cut: snapping }
      else {
        last.eye = eye
        last.look = look
        last.player = followed
        last.cut = snapping
      }
      snapping = false
      camera.fov = klipp.shot.fov
      camera.position.set(eye.x, eye.y, eye.z)
      camera.lookAt(look)
    },
    pose: () => last,
  }
}
