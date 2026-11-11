// A world's room light: its lamps, the time of day's ambient, fill and sun, and the occluders its pieces make, under the
// look profile (key, steps, cap, shade). The game hands the result to `createPixi3dRenderer`'s `lighting`, and the
// renderer's `scene` hook draws the world with it (`drawWorld`).

import type { World } from '../features/world/build.ts'
import { worldOccluders } from '../features/world/occluders.ts'
import type { LampState } from '../shared/level/piece-states.ts'
import { LIGHT_PROFILE } from '../shared/render/light/light-profile.ts'
import type { SceneLighting } from '../shared/render/light/scene-lighting.schema.ts'
import type { TimeOfDay } from '../shared/time-of-day/time-of-day.ts'
import { sceneLamps } from './world-view.ts'

export interface WorldLightingOptions {
  /** Whether a lamp on its photocell burns. Default: the time has no sun, or one that is weak (a night's). */
  readonly night?: boolean | undefined
  /** The lamps' states (`PieceStates.lamps`): a level and a colour over each lamp's own. */
  readonly states?: Readonly<Record<string, LampState>> | undefined
  /** The camera's pitch in degrees, which the sun's direction is taken at. Default the profile's (18). */
  readonly pitch?: number | undefined
}

/** A time of day with no sun, or one too weak to light a day: it lights windows and the lamps on a photocell. */
export const isNightTime = (time: TimeOfDay): boolean => {
  const sun = time.scene.light.sun
  return sun === undefined || sun.level <= 0.5
}

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16)

/**
 * The direction toward the sun in the world: the time's key in view space (x right, y up, z toward the camera), turned out
 * of a camera pitched `pitch` degrees down. A unit vector.
 */
export function sunDirection(time: TimeOfDay, pitch: number): readonly [number, number, number] {
  const [x, y, z] = time.figure.key
  const length = Math.hypot(x, y, z) || 1
  const [c, s] = [Math.cos((pitch * Math.PI) / 180), Math.sin((pitch * Math.PI) / 180)]
  const world = [
    x / length,
    (y / length) * c + (z / length) * s,
    (-y / length) * s + (z / length) * c,
  ] as const
  const size = Math.hypot(...world) || 1
  return [world[0] / size, world[1] / size, world[2] / size]
}

/** The light of `world` at `time`: lamps, the time's ambient, fill and sun, and the planes and boxes the pieces make. */
export function worldLighting(
  world: World,
  time: TimeOfDay,
  options: WorldLightingOptions = {},
): SceneLighting {
  const { boxes, planes } = worldOccluders(world.pieces)
  const { ambient, fill, sun, shadow } = time.scene.light
  const { key, fillFade, light, shade, pitch } = LIGHT_PROFILE
  return {
    ambient: ambient.level,
    ambientColor: hex(ambient.tint),
    colorSpace: 'srgb',
    key,
    fill: { level: fill.level, color: hex(fill.tint), fade: fillFade },
    sun:
      sun === undefined
        ? undefined
        : {
            dir: sunDirection(time, options.pitch ?? pitch),
            color: hex(sun.colour),
            level: sun.level,
            shadow,
          },
    max: light.max,
    step: light.step,
    shade,
    lamps: sceneLamps(world.lamps, options.night ?? isNightTime(time), options.states).map((lamp) => ({
      ...lamp,
      strength: lamp.strength * light.strength,
      ...aimOf(world.lamps, lamp.id),
    })),
    boxes,
    planes,
  }
}

/** A lamp's aim and cone, from the world's lamp of that id. */
function aimOf(lamps: World['lamps'], id: string): Pick<SceneLighting['lamps'][number], 'aim' | 'cone'> {
  const lamp = lamps.find((l) => l.id === id)
  return lamp?.aim === undefined || lamp.cone === undefined ? {} : { aim: lamp.aim, cone: lamp.cone }
}
