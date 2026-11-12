// The gameplay camera's rules as pure functions, ported from the Owner's reference game (its play camera: the room
// follow, the framing dolly and the peek; its camera rules of 2026-10-17). Presentation only: it uses `Math`, and
// `@pixi/3d` is not imported, so every rule is plain arithmetic to test.
//
// A shot is a look point and the eye's offset from it. Every rule here moves the look (and the eye with it) or scales
// the offset along its own line: none turns it. The player turns it, in the sim, in 45° steps, and the rig orbits the
// offset by that heading. So there is no automatic yaw, pitch or roll, and the lens never changes.
//
// A heading of 0 looks toward +z, so the eye stands at −z of the look, `tiltDeg` up and `distance` along the tilt.
import type { Vec3 } from './camera-pose.ts'
import type { CameraView } from './sim/camera-view.schema.ts'

/** Where the camera looks, and the eye's offset from that point (before the player's turn). */
export interface Shot {
  readonly look: Vec3
  readonly offset: Vec3
}

const RADIANS = Math.PI / 180
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))
/** How far `value` is outside ±`radius`, signed; 0 inside. */
const outside = (value: number, radius: number): number =>
  Math.sign(value) * Math.max(0, Math.abs(value) - radius)

/** The quiet radius, in metres on the ground, the player may move within before a locked-on look moves. */
export const FOLLOW_DEAD_ZONE = { landscape: 0.3, portrait: 0.2 } as const

/** How far a narrow (portrait) screen pulls the camera back along its offset; 1 in landscape. */
export const portraitPullback = (aspect: number): number =>
  aspect < 1 ? Math.min(1.75, 0.85 / Math.max(0.1, aspect)) : 1

/** The eye's offset from the look for `view` at heading 0: `distance` back along the tilt, the zone's x skew aside. */
const presetOffset = (view: CameraView, skew: number): Vec3 => {
  const tilt = view.tiltDeg * RADIANS
  return { x: skew, y: view.distance * Math.sin(tilt), z: -view.distance * Math.cos(tilt) }
}

const scaled = (offset: Vec3, by: number): Vec3 => ({ x: offset.x * by, y: offset.y * by, z: offset.z * by })

/**
 * A locked-on view's shot (`follow` 1): the look on the player's focus, the eye straight behind it (the x skew is
 * dropped), the portrait pullback applied. `from` is the look the camera holds now: the player may move within a small
 * central dead zone around it without moving the shot, so idle jitter does not shake it; without `from` the look sits on
 * the player.
 */
function followShot(view: CameraView, followed: Vec3, aspect: number, from: Vec3 | undefined): Shot {
  const radius = aspect < 1 ? FOLLOW_DEAD_ZONE.portrait : FOLLOW_DEAD_ZONE.landscape
  let x = followed.x
  let z = followed.z
  if (from !== undefined) {
    const dx = followed.x - from.x
    const dz = followed.z - from.z
    const distance = Math.hypot(dx, dz)
    const keep = distance <= radius ? 1 : radius / distance
    x = followed.x - dx * keep
    z = followed.z - dz * keep
  }
  const y = view.look?.[1] ?? followed.y + view.focusHeight
  // A focus box holds the look inside the room however far the player walks (a long lens shows a narrow slice of it).
  const box = view.focusBounds
  if (box !== undefined) {
    x = clamp(x, box.min[0], box.max[0])
    z = clamp(z, box.min[1], box.max[1])
  }
  return { look: { x, y, z }, offset: scaled(presetOffset(view, 0), portraitPullback(aspect)) }
}

/**
 * A fixed zone's shot (`follow` below 1): the authored look, a quiet central region, then partial follow with
 * room-sized pan limits. It translates the look and the eye together: following never rotates or zooms the authored shot.
 * Portrait shares the algorithm with earlier, stronger tracking and more pan room. Without `bounds` the shot is still.
 */
function roomShot(view: CameraView, followed: Vec3, aspect: number, fovDeg: number): Shot {
  const authored = view.look as Vec3Tuple
  const depthLook =
    view.depthFollow === undefined ? 0 : (followed.z - view.depthFollow.about) * view.depthFollow.rate
  const preset: Vec3 = { x: authored[0], y: authored[1], z: authored[2] + depthLook }
  const offset = scaled(presetOffset(view, (view.x ?? authored[0]) - authored[0]), portraitPullback(aspect))
  const ground = Math.hypot(offset.x, offset.z)
  const { bounds } = view
  if (bounds === undefined || ground < 1e-6) return { look: preset, offset }
  const distance = Math.hypot(offset.x, offset.y, offset.z)
  // The screen's sideways axis on the floor (rx, rz) and the depth axis along the view (dx, dz).
  const rx = offset.z / ground
  const rz = -offset.x / ground
  const dx = -rz
  const dz = rx
  const x = followed.x - preset.x
  const z = followed.z - preset.z
  const halfHeight = distance * Math.tan((fovDeg * RADIANS) / 2)
  const narrow = aspect < 1
  // Landscape can hold a larger quiet region; narrow screens need earlier, stronger tracking.
  const depthDeadZone = narrow ? 0.14 : 0.244
  const follow = narrow ? 0.65 : 0.45
  const sideways = outside(x * rx + z * rz, halfHeight * Math.max(0.1, aspect) * 0.18) * follow
  const depth =
    outside(x * dx + z * dz, (halfHeight * depthDeadZone) / Math.max(0.1, Math.abs(offset.y) / distance)) *
    follow
  const fraction = narrow ? 0.4 : 0.25
  const maxPan = narrow ? 4 : 2
  const limitX = Math.min(maxPan, (bounds.max[0] - bounds.min[0]) * fraction)
  const limitZ = Math.min(maxPan, (bounds.max[2] - bounds.min[2]) * fraction)
  return {
    look: {
      x: clamp(preset.x + clamp(sideways * rx + depth * dx, -limitX, limitX), bounds.min[0], bounds.max[0]),
      y: preset.y,
      z: clamp(preset.z + clamp(sideways * rz + depth * dz, -limitZ, limitZ), bounds.min[2], bounds.max[2]),
    },
    offset,
  }
}

type Vec3Tuple = readonly [number, number, number]

/**
 * `view`'s play shot for the player at `followed` (the feet) on a screen of `aspect`, through a lens of `fovDeg`: the
 * follow shot when its `follow` is 1 (locked on), else the bounded room shot. `from` is the look the camera holds now.
 */
export function zoneShot(
  view: CameraView,
  followed: Vec3,
  aspect: number,
  fovDeg: number,
  from?: Vec3,
): Shot {
  return view.follow >= 1 || view.look === undefined
    ? followShot(view, followed, aspect, from)
    : roomShot(view, followed, aspect, fovDeg)
}

/**
 * Automatic framing in play: the game may dolly the camera along its own offset, never zoom the lens or turn it.
 * `min` and `max` bound the distance as a share of the zone's authored distance (push-in only: past the authored
 * distance the room hazes out and the outer walls close in); `rate` is the most it changes a second, in the same share,
 * so a full change takes at least a second.
 */
export const PLAY_FRAMING = { min: 0.75, max: 1, rate: 0.25 } as const

/**
 * One frame of automatic framing: the distance scale (1 = the zone's authored distance) moved toward `wanted`, clamped
 * to `PLAY_FRAMING` and its rate. Reduce motion holds the authored distance.
 */
export function stepFraming(
  current: number,
  wanted: number,
  frameSeconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1
  const goal = clamp(wanted, PLAY_FRAMING.min, PLAY_FRAMING.max)
  const step = PLAY_FRAMING.rate * Math.max(0, frameSeconds)
  return clamp(current + clamp(goal - current, -step, step), PLAY_FRAMING.min, PLAY_FRAMING.max)
}

/** The most a peek may move the camera (m), along the floor, with no rotation. */
export const PEEK_REACH = 1.2

/**
 * A peek `offset` along the floor (x, z), cut back to `reach` (a view's `peekReach`, else `PEEK_REACH`) in the same direction. The
 * rig slides the eye and the look by it together, eased in and out, so the angle and the lens stay.
 */
export function clampPeek(
  offset: { readonly x: number; readonly z: number },
  reach: number = PEEK_REACH,
): { x: number; z: number } {
  const length = Math.hypot(offset.x, offset.z)
  const k = length > reach ? reach / length : 1
  return { x: offset.x * k, z: offset.z * k }
}

/** The most gameplay shake moves the picture on either axis, in screen pixels (the reference game's feel limit). */
export const SHAKE_PX = 3

/** A shake of `wanted` pixels as the screen translation the camera shows: whole pixels within `SHAKE_PX`; none when reduced. */
export function shakeOffset(
  wanted: { readonly x: number; readonly y: number },
  reducedMotion: boolean,
): { x: number; y: number } {
  if (reducedMotion) return { x: 0, y: 0 }
  const px = (value: number): number => Math.round(clamp(value, -SHAKE_PX, SHAKE_PX)) + 0
  return { x: px(wanted.x), y: px(wanted.y) }
}

/** `offset` turned `degrees` about the vertical axis: a heading of 0 leaves it, 90 puts the eye at −x of the look. */
export function orbitOffset(offset: Vec3, degrees: number): Vec3 {
  const turn = degrees * RADIANS
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return { x: offset.x * cos + offset.z * sin, y: offset.y, z: -offset.x * sin + offset.z * cos }
}
