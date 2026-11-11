// Which rooms a camera view draws. A view's `rooms` names the sectors drawn while it is active; a view that names none
// draws every room, as before. The rest of what is drawn each frame is the player's and the camera's, so `createRoomDraw`
// adds it to the view's answer: the room the player stands in is always drawn, a room that has just left the set stays
// drawn for `ROOM_HOLD` seconds under the camera's blend (so a cut does not pop it out from under the eye), the far side
// of a peek is drawn while the camera leans toward it, and a cutscene draws every room.
//
// A mass (masonry between rooms) is drawn when any drawn room touches it. The world builder makes no mesh for a mass, so
// this set is for a drawer that has them (an editor's view, a game's own); the sectors' set is what `WorldView.showRooms`
// takes. Pure: no renderer, no clock but the `dt` it is given.
//
// The idea (the held room, the far side of a peek, a cutscene drawing all) is the old game's, which kept it in room
// policies beside the level; here the view's own `rooms` carries it, so the level is the one file that says it.

import type { AfSector2, AfSectorEntry2 } from '../../shared/level/af-sector-2.schema.ts'
import { segmentDistance } from '../../shared/level/geometry.ts'
import type { LevelProblem } from '../../shared/level/problem.ts'
import type { MassDef, Point } from '../../shared/level/sector.schema.ts'
import { inside, ringsOf, standsIn, type V2 } from './sectors.ts'

/** Seconds a room that has just left the drawn set stays drawn: the camera's blend between two views. */
export const ROOM_HOLD = 0.35

/** What is drawn: the sectors by id, and the masses by their index in the level. */
export interface RoomSet {
  readonly sectors: ReadonlySet<string>
  readonly masses: ReadonlySet<number>
}

/** The rooms a view names, or undefined when it names none (so it draws every room). */
function namedBy(level: AfSector2, view: string | undefined): readonly string[] | undefined {
  const rooms = view === undefined ? undefined : level.views?.[view]?.rooms
  return Array.isArray(rooms) && rooms.every((room) => typeof room === 'string') ? rooms : undefined
}

const toPoint = ([x, z]: V2): Point => ({ x, z })

/** Whether the mass and the sector's outline meet: an edge crosses or touches an edge, or one lies inside the other. */
function touches(mass: MassDef, sector: AfSectorEntry2): boolean {
  const outline = (ringsOf(sector)[0] ?? []).map(toPoint)
  const around = mass.points
  const edges = (loop: readonly Point[]) =>
    loop.map((from, i) => [from, loop[(i + 1) % loop.length] as Point] as const)
  for (const [a, b] of edges(around))
    for (const [c, d] of edges(outline)) if (segmentDistance(a, b, c, d) === 0) return true
  const polygon = around.map((p): V2 => [p.x, p.z])
  return around.some((p) => standsIn(sector, p.x, p.z)) || outline.some((p) => inside(polygon, p.x, p.z))
}

/** For each sector, the masses it touches. Worked out once for a level. */
const TOUCHING = new WeakMap<AfSector2, ReadonlyMap<string, readonly number[]>>()

function massesTouching(level: AfSector2): ReadonlyMap<string, readonly number[]> {
  let found = TOUCHING.get(level)
  if (found === undefined) {
    const masses = level.masses ?? []
    found = new Map(
      level.sectors.map((sector) => [
        sector.id,
        masses.flatMap((mass, index) => (touches(mass, sector) ? [index] : [])),
      ]),
    )
    TOUCHING.set(level, found)
  }
  return found
}

const everyMass = (level: AfSector2): ReadonlySet<number> => new Set((level.masses ?? []).map((_, i) => i))

function roomsAndMasses(level: AfSector2, sectors: ReadonlySet<string>): RoomSet {
  const touching = massesTouching(level)
  return { sectors, masses: new Set([...sectors].flatMap((id) => touching.get(id) ?? [])) }
}

/**
 * The sectors and masses drawn while `view` is active: the rooms its `rooms` name, and the masses they touch; with no
 * `rooms`, no view, or a view the level does not have, every room and every mass.
 */
export function drawnRooms(level: AfSector2, view: string | undefined): RoomSet {
  const named = namedBy(level, view)
  if (named === undefined)
    return { sectors: new Set(level.sectors.map((s) => s.id)), masses: everyMass(level) }
  const have = new Set(level.sectors.map((s) => s.id))
  return roomsAndMasses(level, new Set(named.filter((id) => have.has(id))))
}

/** A view that names a room the level lacks: where, and what the level has. Nothing throws; the rest still draws. */
export function viewRoomProblems(level: AfSector2): LevelProblem[] {
  const ids = level.sectors.map((s) => s.id)
  return Object.entries(level.views ?? {}).flatMap(([view, fields]) => {
    const rooms = fields.rooms
    if (rooms === undefined) return []
    if (!Array.isArray(rooms))
      return [
        {
          path: ['views', view, 'rooms'],
          code: 'invalid-view-rooms',
          message: `the camera view "${view}" has \`rooms\` that is not a list of room ids (rooms: ${ids.join(', ')})`,
          where: view,
        },
      ]
    return rooms.flatMap((room, index): LevelProblem[] =>
      ids.includes(room as string)
        ? []
        : [
            {
              path: ['views', view, 'rooms', index],
              code: 'unknown-view-room',
              message: `the camera view "${view}" draws the room "${String(room)}", which the level does not have (rooms: ${ids.join(', ')})`,
              where: view,
              name: String(room),
            },
          ],
    )
  })
}

/** What the camera and the player say this frame. */
export interface RoomDrawInput {
  /** The active camera view's id; none draws every room. */
  readonly view: string | undefined
  /** Where the player stands: their room is always drawn. */
  readonly at: Point | undefined
  /** The spot a peek leans toward, past the doorway: its room is drawn too while the peek holds. */
  readonly peek?: Point | undefined
  /** A cutscene draws every room and forgets the held ones. */
  readonly cutscene?: boolean | undefined
  /** Seconds since the last update. A negative or non-finite step counts as none. */
  readonly dt: number
}

export interface RoomDraw {
  /** The rooms to draw this frame. */
  update(input: RoomDrawInput): RoomSet
  /** Forgets the rooms held over: a new sim, a resync. */
  reset(): void
}

export function createRoomDraw(level: AfSector2): RoomDraw {
  const all = new Set(level.sectors.map((s) => s.id))
  const roomAt = (at: Point | undefined): string | undefined =>
    at === undefined ? undefined : level.sectors.find((sector) => standsIn(sector, at.x, at.z))?.id
  // What was drawn, before the hold, last frame; and each room that left it, with the seconds it has left.
  let previous: ReadonlySet<string> | undefined
  const held = new Map<string, number>()
  const reset = (): void => {
    previous = undefined
    held.clear()
  }
  return {
    reset,
    update(input) {
      if (input.cutscene === true) {
        reset()
        return { sectors: new Set(all), masses: everyMass(level) }
      }
      const dt = Number.isFinite(input.dt) ? Math.max(0, input.dt) : 0
      const named = namedBy(level, input.view)
      const now = new Set(named === undefined ? all : named.filter((id) => all.has(id)))
      for (const at of [input.at, input.peek]) {
        const id = roomAt(at)
        if (id !== undefined) now.add(id)
      }
      // A held room that is drawn again is a drawn room; one that is not runs down.
      for (const [id, left] of held) {
        if (now.has(id) || left - dt <= 0) held.delete(id)
        else held.set(id, left - dt)
      }
      // A room that left the set this frame is held for the blend.
      for (const id of previous ?? []) if (!now.has(id) && !held.has(id)) held.set(id, ROOM_HOLD)
      previous = now
      const sectors = new Set([...now, ...held.keys()])
      return named === undefined ? { sectors, masses: everyMass(level) } : roomsAndMasses(level, sectors)
    },
  }
}
