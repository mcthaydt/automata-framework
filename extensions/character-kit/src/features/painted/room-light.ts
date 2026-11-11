// The room's light on one painted figure, as the builder's `lightSprite` takes it. The renderer's `SceneLight` says what the
// light is at a point (`tint`: the ambient plus each lamp at its level, the occluders in it); the sprite light wants a few
// numbers for the whole figure: a flat light where it stands, and a lamp or two it comes from. This module reads the first
// into the second, with six probes at the chest and four on the floor, so the kit needs to know none of the room's lamps and
// nothing in `@automata/3d` changes. It is pure: the same `tint` answers give the same `RoomLight`, whose `key` is exactly
// what is quantised, so two rooms with one key light a cell to the same bytes and a host may cache the lit cell by it.
import { flatSteps, type SpriteLighting, type V3 } from '../../shared/figure-builder/door.ts'

/** The probes and thresholds, in metres and light units. */
export const ROOM_LIGHT = {
  /** The flat light is read at the chest, this high above the feet. */
  chest: 1.2,
  /** The ring of floor round the feet that the figure is held not hotter than, this far out. */
  ring: 0.75,
  /** How many steps over the ring's light the figure may be: the figure is exposed down to it. */
  hot: 1,
  /** Under this a lean is no direction: no lamp, no form, no rim. */
  floor: 0.05,
} as const

/** What `SceneLight.tint` is: the room's light at a point, facing `normal` when given. */
export type Tint = (
  x: number,
  y: number,
  z: number,
  normal?: readonly [number, number, number],
) => readonly [number, number, number]

/** The sun as `SceneLighting.sun` holds it: the direction toward it in the world, its colour (0xRRGGBB) and its level. */
export interface Sun {
  readonly dir: readonly [number, number, number]
  readonly color: number
  readonly level: number
}

/** The room's light on a figure, and the key that says exactly what `lighting` holds. */
export interface RoomLight {
  readonly lighting: SpriteLighting
  readonly key: string
}

/** One step of the DUEL ramps (`SPRITE_STYLE.stepRatio`): the flat light is rebuilt from whole steps at this ratio. */
const STEP = 1.17
/** A lamp's direction is quantised to eighths a component: finer made a walking figure relight on nearly every step (the bench). */
const EIGHTH = 8
const peak = (c: readonly [number, number, number]): number => Math.max(c[0], c[1], c[2])
const eighths = (v: number): number => Math.round(v * EIGHTH)
/** The flat light's colour is kept to sixteenths a channel. */
const SIXTEENTH = 16
const sixteenths = (v: number): number => Math.round(v * SIXTEENTH)
const tenths = (v: number): number => Math.round(v * 10)
/** The way a figure seen from `azimuth` turns a world vector into its lighting frame: Ry(−azimuth) (the builder's contract). */
function turned(v: readonly [number, number, number], azimuth: number): V3 {
  const c = Math.cos(-azimuth)
  const s = Math.sin(-azimuth)
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}

/** A lamp from a world direction (any length) and a strength: turned, normalised, then quantised to eighths. */
function lamp(
  world: readonly [number, number, number],
  strength: number,
  azimuth: number,
): { readonly dir: V3; readonly strength: number; readonly key: string } | undefined {
  const length = Math.hypot(world[0], world[1], world[2])
  if (!(length > 0)) return undefined
  const [x, y, z] = turned([world[0] / length, world[1] / length, world[2] / length], azimuth)
  const q: V3 = [eighths(x), eighths(y), eighths(z)]
  const t = tenths(strength)
  return {
    dir: [q[0] / EIGHTH, q[1] / EIGHTH, q[2] / EIGHTH],
    strength: t / 10,
    key: `${q.join(',')};${t}`,
  }
}

/**
 * The room's light on a figure whose feet are at `at`, seen from `azimuth` (the painter's view). Pure.
 *
 * - The flat light is `tint` at the chest with no normal.
 * - The lean on each axis is the peak channel of `tint` facing +axis less facing −axis; the three leans are one resultant, one
 *   lamp (two equal lamps either side cancel, and the figure is lit flat, which is right). Under `floor` there is none.
 * - The sun, which `tint` does not hold, is one more lamp. It is not occluded (the occluder test is not public), so a
 *   figure in shade by day still takes the sun's form; the fill has no direction and is left out.
 * - The ring is `tint` facing up at four points round the feet; the figure's steps are held within `hot` of it.
 */
export function roomLight(tint: Tint, sun: Sun | undefined, at: V3, azimuth: number): RoomLight {
  const [x, y, z] = at
  const chest = y + ROOM_LIGHT.chest
  const flat = tint(x, chest, z)
  const lean = (axis: 0 | 1 | 2): number => {
    const plus: [number, number, number] = [0, 0, 0]
    const minus: [number, number, number] = [0, 0, 0]
    plus[axis] = 1
    minus[axis] = -1
    return peak(tint(x, chest, z, plus)) - peak(tint(x, chest, z, minus))
  }
  const resultant: [number, number, number] = [lean(0), lean(1), lean(2)]
  const length = Math.hypot(...resultant)
  const lamps = []
  if (length >= ROOM_LIGHT.floor) {
    const l = lamp(resultant, length, azimuth)
    if (l !== undefined) lamps.push(l)
  }
  if (sun !== undefined) {
    const strength =
      sun.level * (Math.max((sun.color >> 16) & 255, (sun.color >> 8) & 255, sun.color & 255) / 255)
    if (strength >= ROOM_LIGHT.floor) {
      const l = lamp(sun.dir, strength, azimuth)
      if (l !== undefined) lamps.push(l)
    }
  }
  // The ring: what the figure stands on, so it is not brighter than its ground by more than `hot` steps.
  const r = ROOM_LIGHT.ring
  const up: readonly [number, number, number] = [0, 1, 0]
  const around = [tint(x + r, y, z, up), tint(x - r, y, z, up), tint(x, y, z + r, up), tint(x, y, z - r, up)]
  const ring: V3 = [0, 1, 2].map((c) => around.reduce((sum, v) => sum + (v[c] ?? 0), 0) / around.length) as V3
  const steps = flatSteps([flat[0], flat[1], flat[2]])
  const exposure = Math.max(0, steps - flatSteps(ring) - ROOM_LIGHT.hot)
  // The light the sprite is lit with is rebuilt from the quantised values only (steps taken off already, colour in sixteenths),
  // so the key decides the bytes.
  const held = steps - exposure
  const top = peak(flat)
  const colour: V3 = top > 0 ? [flat[0] / top, flat[1] / top, flat[2] / top] : [1, 1, 1]
  const q = colour.map(sixteenths) as V3
  const grey = q[0] === q[1] && q[1] === q[2]
  const scale = STEP ** held
  const lighting: SpriteLighting = {
    flat: grey
      ? [scale, scale, scale]
      : [(q[0] / SIXTEENTH) * scale, (q[1] / SIXTEENTH) * scale, (q[2] / SIXTEENTH) * scale],
    lamps: lamps.map(({ dir, strength }) => ({ dir, strength })),
    exposure: 0,
  }
  const key = `${held}|${grey ? '-' : q.join(',')}|${lamps.length === 0 ? '-' : lamps.map((l) => l.key).join('+')}`
  return { lighting, key }
}
