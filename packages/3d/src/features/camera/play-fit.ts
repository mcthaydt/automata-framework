// Fitting a locked-on view to its room so the followed figure is always whole in the frame, from any heading. Presentation only,
// plain arithmetic (no `@pixi/3d`), so the rule is tested without a renderer.
//
// A game that draws its figure large (a long lens, a whole-pixel sprite that fills much of the frame) has little room on screen
// around it: the look may stand only so far from the figure's feet before the head leaves the top or the feet the bottom. Under a
// camera the player turns freely, that limit holds in every direction on the floor, so it is a radius, `reach`: the farthest the
// look may be from the feet, whichever way the camera faces. The look is held off the player by the follow's dead zone, its lag
// and the lead; what is left of the reach is how far the focus box may stand inside the walkable floor. `fitFocus` derives the
// box and the lead from the room's walkable extent and the projected sprite, never by hand.
import type { Vec3 } from './camera-pose.ts'
import { fovOf, LENS_MM } from './fov.ts'
import { FOLLOW_DEAD_ZONE, orbitOffset, zoneShot } from './play-camera.ts'
import type { CameraView } from './sim/camera-view.schema.ts'

/** The figure as the frame shows it: a whole-pixel sprite whose feet stand on the floor point it is drawn at. */
export interface FitSprite {
  /** Its height in field pixels, feet to the top of the head with its head room (rows times pixels a texel). */
  readonly heightPx: number
  /** Half its width in field pixels. */
  readonly halfWidthPx: number
}

/** A field the frame is drawn into: its height in pixels and its aspect (width over height). */
export interface FitField {
  readonly lines: number
  readonly aspect: number
}

/** A floor rectangle, `[x, z]` corners in metres. */
export interface FloorRect {
  readonly min: readonly [number, number]
  readonly max: readonly [number, number]
}

/** Where the sprite lands in the frame: its box in field pixels from the frame's top left. */
export interface SpriteBox {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(a.x, a.y, a.z)
  return { x: a.x / length, y: a.y / length, z: a.z / length }
}

/**
 * The sprite's box in `field` when the camera of `view` looks at `look` from `headingDeg` (the rig's orbit of the view's offset) and
 * the figure's feet are at `feet`: the feet projected through the pinhole, the sprite standing up from them at its pixel size.
 */
export function spriteBoxAt(
  view: CameraView,
  look: Vec3,
  headingDeg: number,
  feet: Vec3,
  sprite: FitSprite,
  field: FitField,
): SpriteBox {
  const tilt = (view.tiltDeg * Math.PI) / 180
  const offset = orbitOffset(
    { x: 0, y: view.distance * Math.sin(tilt), z: -view.distance * Math.cos(tilt) },
    headingDeg,
  )
  const eye = { x: look.x + offset.x, y: look.y + offset.y, z: look.z + offset.z }
  const forward = unit(sub(look, eye))
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }))
  const up = cross(right, forward)
  const toFeet = sub(feet, eye)
  const depth = dot(toFeet, forward)
  const half = Math.tan((fovOf(view.lensMm ?? LENS_MM) * Math.PI) / 360)
  const x = dot(toFeet, right) / (depth * half)
  const y = dot(toFeet, up) / (depth * half)
  const width = field.lines * field.aspect
  const cx = width / 2 + (x * field.lines) / 2
  const bottom = field.lines / 2 - (y * field.lines) / 2
  return {
    left: cx - sprite.halfWidthPx,
    right: cx + sprite.halfWidthPx,
    top: bottom - sprite.heightPx,
    bottom,
  }
}

/** Whether `box` is inside `field` with `margin` pixels to spare on every side. */
export const insideFrame = (box: SpriteBox, field: FitField, margin: number): boolean =>
  box.left >= margin &&
  box.right <= field.lines * field.aspect - margin &&
  box.top >= margin &&
  box.bottom <= field.lines - margin

/** The headings a fit checks: every 5 degrees. */
const HEADINGS = Array.from({ length: 72 }, (_, i) => i * 5)

/**
 * The view's reach: the farthest (metres, on the floor) the look may be from the feet in any direction, at any heading, with the
 * sprite inside every field of `fields` by `margin` pixels. The look's height is the view's (`look[1]`, else `focusHeight`). A
 * bisection to a centimetre; 0 when the sprite does not fit even with the look on the feet.
 */
export function reachOf(
  view: CameraView,
  sprite: FitSprite,
  fields: readonly FitField[],
  margin: number,
): number {
  const lookY = view.look?.[1] ?? view.focusHeight
  const fits = (r: number): boolean =>
    HEADINGS.every((heading) =>
      HEADINGS.every((direction) => {
        const a = (direction * Math.PI) / 180
        const look = { x: r * Math.sin(a), y: lookY, z: r * Math.cos(a) }
        return fields.every((field) =>
          insideFrame(spriteBoxAt(view, look, heading, { x: 0, y: 0, z: 0 }, sprite, field), field, margin),
        )
      }),
    )
  if (!fits(0)) return 0
  let low = 0
  let high = 4
  while (high - low > 0.01) {
    const mid = (low + high) / 2
    if (fits(mid)) low = mid
    else high = mid
  }
  return low
}

/** What `fitFocus` derives for a view. */
export interface FocusFit {
  /** The floor box the look stays inside. */
  readonly focusBounds: FloorRect
  /** The lead the view may keep (metres), at most what it asked for. */
  readonly lead: number
  /** The follow's time constant (seconds) the view may keep, at most what it asked for. */
  readonly lag: number
  /** The reach the box and the lead were taken from. */
  readonly reach: number
}

/**
 * A locked-on view's focus box, lead and lag from its room: `walkable` is the floor the figure's feet can reach (the room's extent
 * less the figure's radius), `speed` the fastest it walks (m/s). The look is held off the feet by the follow's dead zone (landscape's)
 * and by the larger of the lag at that speed and the lead (the lead runs ahead of a walking figure, the lag behind it, along the same
 * line); the reach less the dead zone is the budget both share, so a lag or a lead larger than the budget is cut to it. What is left
 * is how far inside the walkable floor the box may stand, on both axes at once (a corner is the far case, so each axis takes the
 * remainder over the square root of two). A room narrower than twice the inset gets a box of its middle line on that axis.
 */
export function fitFocus(
  view: CameraView,
  walkable: FloorRect,
  speed: number,
  sprite: FitSprite,
  fields: readonly FitField[],
  margin: number,
): FocusFit {
  const reach = reachOf(view, sprite, fields, margin)
  const budget = Math.max(0, reach - FOLLOW_DEAD_ZONE.landscape)
  const floor2 = (value: number): number => Math.floor(value * 100) / 100
  const lag = Math.min(view.lag, floor2(budget / Math.max(speed, 1e-6)))
  const lead = floor2(Math.min(view.lead ?? 0, budget))
  const spare = Math.max(0, budget - Math.max(lag * speed, lead))
  const inset = spare / Math.SQRT2
  const axis = (low: number, high: number): [number, number] =>
    high - low >= 2 * inset ? [low + inset, high - inset] : [(low + high) / 2, (low + high) / 2]
  const [x0, x1] = axis(walkable.min[0], walkable.max[0])
  const [z0, z1] = axis(walkable.min[1], walkable.max[1])
  const round = (value: number): number => Math.round(value * 100) / 100
  return { focusBounds: { min: [round(x0), round(z0)], max: [round(x1), round(z1)] }, lead, lag, reach }
}

/**
 * The look height (metres, 0.5 to 1.5 in 5 cm steps) that gives `view` the largest reach: the figure centred in the band the frame
 * leaves it, so its head and its feet have the same room. Ties keep the lower.
 */
export function bestLookHeight(
  view: CameraView,
  sprite: FitSprite,
  fields: readonly FitField[],
  margin: number,
): number {
  let best = { height: 0.5, reach: -1 }
  for (let step = 0; step <= 20; step++) {
    const height = Math.round((0.5 + step * 0.05) * 100) / 100
    const reach = reachOf({ ...view, look: [0, height, 0] }, sprite, fields, margin)
    if (reach > best.reach) best = { height, reach }
  }
  return best.height
}

/**
 * Where a locked-on view's camera looks for the figure at `feet`, given a look it held (`from`) and a lead: the rule the rig runs
 * (`zoneShot`), for a fit's checks.
 */
export function followLook(view: CameraView, feet: Vec3, lead: { x: number; z: number }, from?: Vec3): Vec3 {
  return zoneShot(view, { x: feet.x + lead.x, y: feet.y, z: feet.z + lead.z }, 4 / 3, 0, from).look
}
