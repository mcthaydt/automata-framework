// The dungeon solver for G3-q (DESIGN.md §6.5, §19; GAME-3D.1f part 5), over a compiled world. Rooms are nodes; two
// rooms touching along an edge are joined where a gap at least Wick's width is left by the walls, through whatever
// pieces stand in it (a door by its lock, a cracked wall with bombs), and an
// area exit joins its room to the room of its entry. Chests open as soon as their room is reached and their `hidden`
// ref holds, which can only help. The small-key and boss doors are the choices: every order of opening them is tried,
// and a state with goals left and no door to open is a soft lock. Test code.
import { ENEMIES } from '../constants/enemies.ts'
import { HERO_HALF } from '../constants/index.ts'
import type { Area, AreaEntity, PlanBox, World } from '../systems/area.ts'

export interface SolveResult {
  /** Every room reached on some path, as `<area>/<view>`, sorted. */
  readonly rooms: readonly string[]
  /** Every chest opened on some path, as `<area>/<id>`, sorted. */
  readonly chests: readonly string[]
  /** The rooms a Warden stands in that some path reaches. */
  readonly bossRooms: readonly string[]
  /** Each dead end: the doors opened on the way and the goals left, as text. */
  readonly softLocks: readonly string[]
}

/** What a passage between two rooms needs: nothing, a door open, or an item. */
type Need = { readonly door: string } | { readonly item: string }
interface Passage {
  readonly from: string
  readonly to: string
  readonly needs: readonly Need[]
}
interface Piece {
  readonly key: string
  readonly area: Area
  readonly entity: AreaEntity
  readonly room: string | undefined
}

const WIDTH = 2 * HERO_HALF
/** The Warden's kind (its index + 1 in the enemies' table), which marks the boss room. */
const WARDEN = ENEMIES.findIndex((enemy) => enemy.rank === 'warden') + 1
const inside = (box: PlanBox, x: number, z: number): boolean =>
  x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ
const roomOf = (area: Area, x: number, z: number): string | undefined => {
  const room = area.rooms.find((box) => inside(box, x, z))
  return room === undefined ? undefined : `${area.id}/${room.view}`
}
const boxOf = (entity: AreaEntity): PlanBox => {
  const halfW = Math.trunc((entity.width as number) / 2)
  const halfD = Math.trunc((entity.depth as number) / 2)
  return { minX: entity.x - halfW, minZ: entity.z - halfD, maxX: entity.x + halfW, maxZ: entity.z + halfD }
}

/** `[lo, hi]` less every interval in `cuts`, as the intervals left. */
function subtract(lo: number, hi: number, cuts: readonly (readonly [number, number])[]): [number, number][] {
  let left: [number, number][] = [[lo, hi]]
  for (const [a, b] of cuts)
    left = left.flatMap(([l, h]): [number, number][] =>
      b <= l || a >= h
        ? [[l, h]]
        : [...(a > l ? [[l, a] as [number, number]] : []), ...(b < h ? [[b, h] as [number, number]] : [])],
    )
  return left
}

/** The passages between two rooms of `area` that touch along a line, from the gaps its walls leave. */
function passagesBetween(area: Area, a: Area['rooms'][number], b: Area['rooms'][number]): Passage[] {
  // The shared line: x = at (a vertical edge) or z = at, over [lo, hi] on the other axis.
  const vertical = a.maxX === b.minX || b.maxX === a.minX
  const horizontal = a.maxZ === b.minZ || b.maxZ === a.minZ
  if (!vertical && !horizontal) return []
  const at = vertical ? (a.maxX === b.minX ? a.maxX : a.minX) : a.maxZ === b.minZ ? a.maxZ : a.minZ
  const lo = vertical ? Math.max(a.minZ, b.minZ) : Math.max(a.minX, b.minX)
  const hi = vertical ? Math.min(a.maxZ, b.maxZ) : Math.min(a.maxX, b.maxX)
  if (hi - lo < WIDTH) return []
  const across = (box: PlanBox): readonly [number, number] | undefined =>
    vertical
      ? box.minX <= at && box.maxX >= at
        ? [box.minZ, box.maxZ]
        : undefined
      : box.minZ <= at && box.maxZ >= at
        ? [box.minX, box.maxX]
        : undefined
  const cuts = area.walls.flatMap((wall) => {
    const span = across(wall)
    return span === undefined ? [] : [span]
  })
  const from = `${area.id}/${a.view}`
  const to = `${area.id}/${b.view}`
  return subtract(lo, hi, cuts)
    .filter(([l, h]) => h - l >= WIDTH)
    .flatMap(([l, h]): Passage[] => {
      const pieces = area.entities.filter((entity) => {
        if (entity.def !== 'door' && entity.def !== 'cracked') return false
        const span = across(boxOf(entity))
        return span !== undefined && span[0] < h && span[1] > l
      })
      // A gap Wick's width that no piece stands in is open both ways.
      const spans = pieces.map((entity) => across(boxOf(entity)) as readonly [number, number])
      if (subtract(l, h, spans).some(([fl, fh]) => fh - fl >= WIDTH))
        return [
          { from, to, needs: [] },
          { from: to, to: from, needs: [] },
        ]
      const needs: Need[] = pieces.map((entity) =>
        entity.def === 'door' ? { door: `${area.id}/${entity.id}` } : { item: 'bombs' },
      )
      return [
        { from, to, needs },
        { from: to, to: from, needs },
      ]
    })
}

/** Every passage of the world: between touching rooms, and from each exit's room to its entry's. */
function passagesOf(world: World): Passage[] {
  return world.areas.flatMap((area) => [
    ...area.rooms.flatMap((a, i) => area.rooms.slice(i + 1).flatMap((b) => passagesBetween(area, a, b))),
    ...area.exits.flatMap((exit): Passage[] => {
      const from = roomOf(
        area,
        Math.trunc((exit.minX + exit.maxX) / 2),
        Math.trunc((exit.minZ + exit.maxZ) / 2),
      )
      const target = world.areas.find((other) => other.id === exit.to)
      const to = target === undefined ? undefined : roomOf(target, exit.entry.x, exit.entry.z)
      return from === undefined || to === undefined ? [] : [{ from, to, needs: [] }]
    }),
  ])
}

interface State {
  readonly opened: readonly string[]
  readonly spent: number
  readonly bossKeySpent: boolean
}
interface Closure {
  readonly rooms: Set<string>
  readonly chests: Set<string>
  readonly items: Set<string>
  readonly keys: number
  readonly bossKey: boolean
}

/** Solves `world` from its first area's spawn (G3-q). */
export function solveWorld(world: World): SolveResult {
  const passages = passagesOf(world)
  const pieces: Piece[] = world.areas.flatMap((area) =>
    area.entities.map((entity) => ({
      key: `${area.id}/${entity.id}`,
      area,
      entity,
      room: roomOf(area, entity.x, entity.z),
    })),
  )
  const chests = pieces.filter((piece) => piece.entity.def === 'chest')
  const doors = pieces.filter((piece) => piece.entity.def === 'door')
  const first = world.areas[0] as Area
  const start = roomOf(first, first.spawn.x, first.spawn.z) as string
  const bossRooms = world.areas.flatMap((area) =>
    area.foes.flatMap((foe) => {
      const room = foe.kind === WARDEN ? roomOf(area, foe.x, foe.z) : undefined
      return room === undefined ? [] : [room]
    }),
  )
  const goals = [...chests.map((chest) => chest.key), ...bossRooms]

  /** Whether the piece `key` names is on or open, from what is reached and owned (a chest's `hidden`, a switch door). */
  const holds = (area: Area, id: string, reached: Closure, state: State): boolean => {
    const piece = pieces.find((other) => other.key === `${area.id}/${id}`)
    if (piece === undefined || piece.room === undefined || !reached.rooms.has(piece.room)) return false
    if (piece.entity.def === 'door') return doorOpen(piece, reached, state)
    // An eye is lit by a pellet: the sling (its sling target's room is the same room in the Kiln's layouts).
    if (piece.entity.def === 'switch' && piece.entity.kind === 'eye') return reached.items.has('sling')
    if (piece.entity.def === 'cracked') return reached.items.has('bombs')
    return true
  }
  /** Whether a door is open: a key door by the choices made, any other by its rule. */
  const doorOpen = (door: Piece, reached: Closure, state: State): boolean => {
    const lock = door.entity.lock
    if (lock === 'small-key' || lock === 'boss-key') return state.opened.includes(door.key)
    if (lock === 'switch') return holds(door.area, door.entity.switch as string, reached, state)
    // A clear door opens once its room's foes are beaten, from whichever side Wick reaches; a plain one with a press.
    return door.room !== undefined && reached.rooms.has(door.room)
  }

  /** Everything reachable with the doors `state` opened: rooms, chests opened, items and keys in hand. */
  function close(state: State): Closure {
    let reached: Closure = {
      rooms: new Set([start]),
      chests: new Set(),
      items: new Set(),
      keys: 0,
      bossKey: false,
    }
    for (;;) {
      const rooms = new Set(reached.rooms)
      let grew = true
      while (grew) {
        grew = false
        for (const passage of passages) {
          if (!rooms.has(passage.from) || rooms.has(passage.to)) continue
          const open = passage.needs.every((need) =>
            'item' in need
              ? reached.items.has(need.item)
              : doorOpen(doors.find((door) => door.key === need.door) as Piece, { ...reached, rooms }, state),
          )
          if (open) {
            rooms.add(passage.to)
            grew = true
          }
        }
      }
      const opened = chests.filter(
        (chest) =>
          chest.room !== undefined &&
          rooms.has(chest.room) &&
          (chest.entity.hidden === undefined ||
            holds(chest.area, chest.entity.hidden as string, { ...reached, rooms }, state)),
      )
      const contents = opened.map((chest) => chest.entity.contents as string)
      const next: Closure = {
        rooms,
        chests: new Set(opened.map((chest) => chest.key)),
        items: new Set(contents),
        keys: contents.filter((item) => item === 'small-key').length - state.spent,
        bossKey: contents.includes('boss-key') && !state.bossKeySpent,
      }
      if (next.rooms.size === reached.rooms.size && next.chests.size === reached.chests.size) return next
      reached = next
    }
  }

  const rooms = new Set<string>()
  const opened = new Set<string>()
  const bosses = new Set<string>()
  const softLocks: string[] = []
  const seen = new Set<string>()
  const walk = (state: State): void => {
    const signature = state.opened.join(',')
    if (seen.has(signature)) return
    seen.add(signature)
    const reached = close(state)
    for (const room of reached.rooms) rooms.add(room)
    for (const chest of reached.chests) opened.add(chest)
    for (const room of bossRooms) if (reached.rooms.has(room)) bosses.add(room)
    const left = goals.filter((goal) => !reached.chests.has(goal) && !reached.rooms.has(goal))
    if (left.length === 0) return
    // The key doors Wick stands beside (one of their rooms reached) and can open with what he holds.
    const choices = doors.filter((door) => {
      if (state.opened.includes(door.key)) return false
      const beside = passages.some(
        (passage) =>
          reached.rooms.has(passage.from) &&
          passage.needs.some((need) => 'door' in need && need.door === door.key),
      )
      return (
        beside &&
        (door.entity.lock === 'small-key'
          ? reached.keys > 0
          : door.entity.lock === 'boss-key' && reached.bossKey)
      )
    })
    if (choices.length === 0) {
      const path = state.opened.length === 0 ? 'nothing' : state.opened.join(', ')
      softLocks.push(`opened ${path}; unreached ${[...left].sort().join(', ')}`)
      return
    }
    for (const door of choices)
      walk({
        opened: [...state.opened, door.key].sort(),
        spent: state.spent + (door.entity.lock === 'small-key' ? 1 : 0),
        bossKeySpent: state.bossKeySpent || door.entity.lock === 'boss-key',
      })
  }
  walk({ opened: [], spent: 0, bossKeySpent: false })
  return {
    rooms: [...rooms].sort(),
    chests: [...opened].sort(),
    bossRooms: [...bosses].sort(),
    softLocks: softLocks.sort(),
  }
}
