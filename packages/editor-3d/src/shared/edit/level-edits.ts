// The edits that change the whole level rather than a room or a thing: the time of day (plan 16.2). Each is one
// undoable step and writes one member of the file.

import { type Edit, ok, refuse } from './edit'

export interface SetTimeOfDayArgs {
  /** A time's name (`dusk`); none takes the level's time off, and the game's own look is used. */
  readonly time: string | undefined
  /** The time's name in words, for the Undo label. */
  readonly label?: string | undefined
}

export function setTimeOfDay<D>(args: SetTimeOfDayArgs): Edit<D> {
  return {
    id: 'level.setTimeOfDay',
    label:
      args.time === undefined
        ? 'Take off the time of day'
        : `Set the time of day to ${args.label ?? args.time}`,
    run(profile, level) {
      const access = profile.time
      if (access === undefined) return refuse('this kind of level has no time of day')
      const options = access.options()
      if (args.time !== undefined && !options.some((each) => each.id === args.time))
        return refuse(
          `There is no time of day called "${args.time}" (${options.map((each) => each.id).join(', ')})`,
        )
      if (access.of(level) === args.time) return ok(level)
      return ok(access.withTime(level, args.time))
    },
  }
}
