// The gameplay camera on a `@pixi/3d` camera: the reference game's play camera (Owner, 2026-11-10: the default 3D gameplay
// camera matches it), as a rig a game can override view by view. Presentation
// only (law 1): it reads interpolated positions and the sim's heading and writes only the `Camera3D` it is given.
//
// The rules, each in `play-camera.ts` and tested there and here:
// - a 50 mm lens (`LENS_MM`) and a 30° home tilt, in every view; the lens never changes;
// - it follows the player: the look trails them outside a small dead zone, and a fixed zone (`follow` below 1) holds its
//   authored shot and pans a little inside its bounds. The eye and the look ease with a time constant of the view's
//   `lag` (1/7 s), so the camera never turns while it catches up;
// - the player turns it in eight 45° steps (the sim's `camera-turn`); the rig eases round to the sim's heading. Nothing
//   else yaws, pitches or rolls it: every other move (follow, dolly, peek, shake) translates it or slides it along its
//   own line;
// - automatic framing is a push-in dolly only, 0.75 to 1 times the view's distance, at most 0.25 times a second, held
//   under reduce motion;
// - a peek is an offset of at most 1.2 m with no rotation; gameplay shake is a screen translation.
//
// klipp (`@pmndrs/klipp`, Owner 2026-10-30: "keep in mind for the camera we're using klipp") is the camera brain, run
// headless as in the reference game: one `play` virtual camera whose body writes the shot this module solves, and `klipp.shot`
// is what reaches the `Camera3D`. A game with a cutscene camera adds a second virtual camera of a higher priority.
//
// Nothing runs before the first `follow`: the renderer draws frames before the player's row exists, and a pose from the
// origin would make the first view swoop in from there.
import { reducedMotion as prefersReducedMotion } from '@automataframework/framework'
import type { Camera3D } from '@pixi/3d'
import { BlendCurves, Klipp, VirtualCamera } from '@pmndrs/klipp'
import { framedFocus, shorterArc, type Vec3 } from './camera-pose.ts'
import { fovOf, LENS_MM } from './fov.ts'
import { clampPeek, orbitOffset, shakeOffset, stepFraming, zoneShot } from './play-camera.ts'
import type { CameraView } from './sim/camera-view.schema.ts'

/** How fast the camera turns to the sim's heading: this share of the gap a second (clamped to the whole gap). */
const HEADING_RATE = 10
/** A 180 px tall frame, the base game's: how many pixels a shake of one pixel moves the picture, unless told otherwise. */
const DEFAULT_VIEWPORT_HEIGHT = 180

export interface CameraRig {
  /** 50, in every view. */
  readonly lensMm: number
  setViews(views: readonly CameraView[]): void
  /** The view `id` among the rig's views, if any. */
  viewOf(id: string): CameraView | undefined
  /** The active view's id: the one the rig started in until `activate` names another. */
  active(): string | undefined
  /**
   * Makes `id` the active view: `ease` lets the camera ease to its shot (a cut under reduced motion); `cut` snaps to the
   * followed position, even into the view already active (a new sim, a resync). An unknown id warns once.
   */
  activate(id: string, how: 'cut' | 'ease'): void
  /**
   * The sim's heading in degrees. The camera eases round to it the shorter way (at once under reduced motion). The
   * heading only ever steps by 45° (the player's Q and R) or lands on a zone's authored angle, so `how` changes nothing
   * today and stays for callers that name it.
   */
  heading(yawDeg: number, how?: 'track' | 'ease'): void
  /** The followed position, interpolated: the player's feet. The first call snaps the focus to it. */
  follow(x: number, y: number, z: number): void
  /** Lock-on: lean the focus toward the target (up to 35%, inside the bounds and the middle third); none clears it. */
  frame(lock?: Vec3): void
  /**
   * Automatic framing: the distance wanted as a share of the view's (1 is the authored distance), clamped to 0.75 to 1
   * and approached at most 0.25 a second. Reduce motion holds 1. `1` or none lets go.
   */
  framing(wanted?: number): void
  /** A peek: an offset along the floor (x, z) in metres, cut back to 1.2 m, with no rotation; none lets go. */
  peek(offset?: { readonly x: number; readonly z: number }): void
  /**
   * Gameplay shake: the picture moves by this many pixels (x right, y up), whole pixels and 3 at most on each axis,
   * as a screen translation of the camera with no rotation; none under reduce motion; none lets go.
   */
  shake(offset?: { readonly x: number; readonly y: number }): void
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
  /** The frame's width over its height, for the shot's portrait rules and lock-on's middle third. Default 16:9. */
  readonly aspect?: (() => number) | undefined
  /** The frame's height in pixels, for how far a pixel of shake moves the picture. Default 180. */
  readonly viewportHeight?: (() => number) | undefined
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: (() => boolean) | undefined
  /** Where a run-time problem is reported (an unknown view id, once per id). Default `console.warn`. */
  readonly warn?: ((message: string) => void) | undefined
}

/** The pose the `play` camera's body writes each frame. */
interface Written {
  eye: Vec3
  look: Vec3
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const scale = (a: Vec3, by: number): Vec3 => ({ x: a.x * by, y: a.y * by, z: a.z * by })
const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a.x, a.y, a.z))
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const lerp = (from: Vec3, to: Vec3, t: number): Vec3 => add(from, scale(sub(to, from), t))

export function angledCamera(options: AngledCameraOptions): CameraRig {
  const { camera } = options
  const aspect = options.aspect ?? (() => 16 / 9)
  const viewportHeight = options.viewportHeight ?? (() => DEFAULT_VIEWPORT_HEIGHT)
  const isReduced = options.reducedMotion ?? (() => prefersReducedMotion())
  const warn = options.warn ?? ((message: string) => console.warn(`[automata-3d] ${message}`))
  const fov = fovOf(LENS_MM)

  // The brain: a cut is the only blend there is, because the shot is eased before it reaches klipp.
  const klipp = new Klipp({ defaultBlend: { curve: BlendCurves.cut, time: 0 } })
  const written: Written = { eye: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 1 } }
  const play = new VirtualCamera('play', { priority: 1, initialState: { fov } })
  play.body = {
    update(out) {
      out.position[0] = written.eye.x
      out.position[1] = written.eye.y
      out.position[2] = written.eye.z
      out.lookAtTarget[0] = written.look.x
      out.lookAtTarget[1] = written.look.y
      out.lookAtTarget[2] = written.look.z
      out.hasLookAtTarget = true
      out.fov = fov
    },
  }
  klipp.add(play)

  const views = new Map<string, CameraView>()
  let active: CameraView | undefined
  const warned = new Set<string>()

  let followed: Vec3 | undefined
  let lock: Vec3 | undefined
  let headingTarget = 0
  let azimuth = 0
  let framing = 1
  let framingWanted = 1
  let peek: { readonly x: number; readonly z: number } | undefined
  let shake: { readonly x: number; readonly y: number } | undefined
  // The eased pose, before a peek and a shake: where the look and the eye are now. The peek eases on its own, so it
  // never feeds back into the follow's dead zone.
  let eased: { look: Vec3; eye: Vec3 } | undefined
  let peeked: { x: number; z: number } = { x: 0, z: 0 }
  // The next update snaps: the first after the first follow, or after a cut.
  let snapping = true
  let last: { eye: Vec3; look: Vec3; player: Vec3; cut: boolean } | undefined

  const setViews = (next: readonly CameraView[]): void => {
    views.clear()
    for (const view of next) views.set(view.id, view)
    if (active !== undefined) active = views.get(active.id) ?? active
  }

  setViews(options.views)
  active = views.get(options.initial)
  if (active === undefined)
    throw new Error(`angledCamera: the initial view "${options.initial}" is not among the views`)

  return {
    lensMm: LENS_MM,
    setViews,
    viewOf: (id) => views.get(id),
    active: () => active?.id,
    activate(id, how) {
      const view = views.get(id)
      if (view === undefined) {
        if (!warned.has(id)) {
          warned.add(id)
          warn(`no camera view "${id}": the camera keeps "${active?.id}"`)
        }
        return
      }
      active = view
      if (how === 'cut' || followed === undefined) snapping = true
    },
    heading(yawDeg) {
      headingTarget = yawDeg
    },
    follow(x, y, z) {
      followed = { x, y, z }
    },
    frame(next) {
      lock = next
    },
    framing(wanted = 1) {
      framingWanted = wanted
    },
    peek(offset) {
      peek = offset
    },
    shake(offset) {
      shake = offset
    },
    update(frameSeconds) {
      if (followed === undefined || active === undefined) return
      const view = active
      const reduced = isReduced()
      // A cut or reduce motion puts the pose where it belongs this frame; only a cut also drops the dead zone's held look.
      const snap = snapping || reduced
      const player = followed
      const frameAspect = aspect()

      // Lock-on: the player's focus leaned toward the target, kept in the middle third, as a followed position.
      let tracked = player
      if (lock !== undefined) {
        const focus = framedFocus({ player, lock, view, headingDeg: azimuth, aspect: frameAspect })
        tracked = { x: focus.x, y: focus.y - view.focusHeight, z: focus.z }
      }

      // The turn the player asked for, eased round (all of it at once when snapping or reduced).
      azimuth = snap
        ? headingTarget
        : azimuth + shorterArc(azimuth, headingTarget) * Math.min(1, frameSeconds * HEADING_RATE)
      framing = stepFraming(framing, framingWanted, frameSeconds, reduced)

      const shot = zoneShot(view, tracked, frameAspect, fov, snapping ? undefined : eased?.look)
      const offset = orbitOffset(
        { x: shot.offset.x * framing, y: shot.offset.y * framing, z: shot.offset.z * framing },
        azimuth,
      )
      const target = { look: shot.look, eye: add(shot.look, offset) }
      const t = snap || view.lag <= 0 ? 1 : 1 - Math.exp(-Math.max(0, frameSeconds) / view.lag)
      eased =
        eased === undefined || snap
          ? target
          : { look: lerp(eased.look, target.look, t), eye: lerp(eased.eye, target.eye, t) }

      // A peek slides the eye and the look together along the floor, eased in and out: no rotation.
      const wanted = clampPeek(peek ?? { x: 0, z: 0 })
      peeked = snap
        ? wanted
        : { x: peeked.x + (wanted.x - peeked.x) * t, z: peeked.z + (wanted.z - peeked.z) * t }
      const peekSlide = { x: peeked.x, y: 0, z: peeked.z }
      let eye = add(eased.eye, peekSlide)
      let look = add(eased.look, peekSlide)

      // Shake moves the picture, not the camera's aim: eye and look slide together along the camera's own screen axes.
      const moved = shakeOffset(shake ?? { x: 0, y: 0 }, reduced)
      if (moved.x !== 0 || moved.y !== 0) {
        const forward = unit(sub(look, eye))
        const right = unit(cross(forward, { x: 0, y: 1, z: 0 }))
        const up = cross(right, forward)
        const reach = Math.hypot(look.x - eye.x, look.y - eye.y, look.z - eye.z)
        const metresPerPixel = (2 * reach * Math.tan((fov * Math.PI) / 360)) / Math.max(1, viewportHeight())
        const slide = add(scale(right, -moved.x * metresPerPixel), scale(up, -moved.y * metresPerPixel))
        eye = add(eye, slide)
        look = add(look, slide)
      }

      if (last === undefined) last = { eye, look, player, cut: snapping }
      else {
        last.eye = eye
        last.look = look
        last.player = player
        last.cut = snapping
      }
      snapping = false
      written.eye = eye
      written.look = look
      klipp.update(frameSeconds)
      const { position, lookAtTarget } = klipp.shot
      camera.fov = klipp.shot.fov
      camera.position.set(position[0], position[1], position[2])
      camera.lookAt({ x: lookAtTarget[0], y: lookAtTarget[1], z: lookAtTarget[2] })
    },
    pose: () => last,
  }
}
