// The six times of day both builders share (day, golden, dusk, night, lampLit, bar), merged into one library
// (library/times.json), and the lookup a level and the look read them through.

import times from './library/times.json' with { type: 'json' }
import { type TimeOfDayEntry, timeOfDaySchema } from './time-of-day.schema.ts'

/** A time of day with its name: the library's key, or the file name of a game's own. */
export interface TimeOfDay extends TimeOfDayEntry {
  readonly name: string
}

/** A part of a time a level changes; the rest stays as the library has it. */
export interface TimeOverrides {
  readonly label?: string
  readonly scene?: Partial<TimeOfDay['scene']>
  readonly figure?: Partial<TimeOfDay['figure']>
}

/** The library, in the order the editor lists it, each entry checked by the schema when this file loads. */
export const TIMES: readonly TimeOfDay[] = Object.entries(times).map(([name, entry]) => ({
  name,
  ...timeOfDaySchema.parse(entry),
}))

/** The time of day called `name`, with `overrides` laid over it; a name the library lacks says which it has. */
export function timeOfDay(name: string, overrides: TimeOverrides = {}): TimeOfDay {
  const found = TIMES.find((time) => time.name === name)
  if (!found) {
    const names = TIMES.map((time) => time.name).join(', ')
    throw new RangeError(`There is no time of day called "${name}" (${names})`)
  }
  return {
    name,
    label: overrides.label ?? found.label,
    scene: { ...found.scene, ...overrides.scene },
    figure: { ...found.figure, ...overrides.figure },
  }
}
