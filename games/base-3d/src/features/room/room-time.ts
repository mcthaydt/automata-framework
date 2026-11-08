// The light the room is played in: the time of day its level file names. The 3D editor's Time of day picker writes it as
// a name (`"night"`) or, for a time with changes of its own, as `{ "preset": "dusk", ...changes }`. The look's passes read
// it through the renderer's `time` option, so what the editor saves is what the player sees.
import { type TimeOfDay, type TimeOverrides, timeOfDay } from '@automata/3d'
import type { AfSector2File } from '@automata/3d/level'

/** The time a level names, with its own changes over its preset's; the day when it names none. */
export function levelTime(time: AfSector2File['time']): TimeOfDay {
  if (time === undefined) return timeOfDay('day')
  if (typeof time === 'string') return timeOfDay(time)
  const { preset, ...changes } = time
  return timeOfDay(preset ?? 'day', changes as TimeOverrides)
}

/** The darkest the room gets: the player can still see the floor they have to cross at night. */
const DARKEST = 0.4

/**
 * How bright the room's colours are by this time, against the day's: 1 for the day, dimmer for a dimmer ambient light,
 * never below `DARKEST`.
 */
export function timeShade(time: TimeOfDay): number {
  const day = timeOfDay('day').scene.light.ambient.level
  const ratio = Math.min(1, Math.max(0, time.scene.light.ambient.level / day))
  return DARKEST + (1 - DARKEST) * ratio
}

/** `colour` with each channel scaled by `shade` (0 to 1). */
export function shadeColour(colour: number, shade: number): number {
  const channel = (shift: number): number => Math.round(((colour >> shift) & 0xff) * shade)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}
