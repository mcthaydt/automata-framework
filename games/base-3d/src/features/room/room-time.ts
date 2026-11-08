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
