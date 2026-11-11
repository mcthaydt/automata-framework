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

export interface SetViewRoomsArgs {
  /** The camera view's id. */
  readonly view: string
  /** The rooms (sector ids) it draws; none, or an empty list, takes them off so it draws every room. */
  readonly rooms: readonly string[] | undefined
}

/**
 * The rooms a camera view draws, written as the view's `rooms` member. A view that names no rooms draws every room, so an
 * empty list takes the member off rather than writing a view that draws none (the schema refuses one).
 */
export function setViewRooms<D>(args: SetViewRoomsArgs): Edit<D> {
  const wanted = args.rooms === undefined || args.rooms.length === 0 ? undefined : args.rooms
  return {
    id: 'level.setViewRooms',
    label: `Set the rooms the camera ${args.view} draws`,
    coalesce: `view-rooms:${args.view}`,
    run(profile, level) {
      const access = profile.viewRooms
      if (access === undefined) return refuse('this kind of level has no rooms for a camera to draw')
      if (!(profile.views?.(level) ?? []).includes(args.view))
        return refuse(`There is no camera called "${args.view}" in this level`)
      const have = profile.sectors.list(level).map((each) => each.id)
      const missing = wanted?.find((room) => !have.includes(room))
      if (missing !== undefined) return refuse(`There is no room called "${missing}" (${have.join(', ')})`)
      const before = access.of(level, args.view)
      if (before?.join('\n') === wanted?.join('\n')) return ok(level)
      return ok(access.withRooms(level, args.view, wanted))
    },
  }
}
