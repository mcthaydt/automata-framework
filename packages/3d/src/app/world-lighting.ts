// A world's room light: its lamps, the time of day's ambient, and the occluders its pieces make. The game hands the result
// to `createPixi3dRenderer`'s `lighting`, and the renderer's `scene` hook draws the world with it (`drawWorld`).

import type { World } from '../features/world/build.ts'
import { worldOccluders } from '../features/world/occluders.ts'
import type { LampState } from '../shared/level/piece-states.ts'
import type { SceneLighting } from '../shared/render/light/scene-lighting.schema.ts'
import type { TimeOfDay } from '../shared/time-of-day/time-of-day.ts'
import { sceneLamps } from './world-view.ts'

export interface WorldLightingOptions {
  /** Whether a lamp on its photocell burns. Default: the time has no sun, or one that is weak (a night's). */
  readonly night?: boolean | undefined
  /** The lamps' states (`PieceStates.lamps`): a level and a colour over each lamp's own. */
  readonly states?: Readonly<Record<string, LampState>> | undefined
}

/** A time of day with no sun, or one too weak to light a day: it lights windows and the lamps on a photocell. */
export const isNightTime = (time: TimeOfDay): boolean => {
  const sun = time.scene.light.sun
  return sun === undefined || sun.level <= 0.5
}

/** The light of `world` at `time`: lamps, ambient, and the planes and boxes its walls, floors, ceilings and props make. */
export function worldLighting(
  world: World,
  time: TimeOfDay,
  options: WorldLightingOptions = {},
): SceneLighting {
  const { boxes, planes } = worldOccluders(world.pieces)
  return {
    ambient: time.scene.light.ambient.level,
    ambientColor: 0xffffff,
    lamps: sceneLamps(world.lamps, options.night ?? isNightTime(time), options.states),
    boxes,
    planes,
  }
}
