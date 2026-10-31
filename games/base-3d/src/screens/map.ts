// The Map screen's plan (DESIGN.md §9.4, GAME-3D.1e part 5c), drawn from the area's compiled geometry: nothing is
// authored. Each room is a plan box named by its camera view; the room Wick stands in and the visited ones are
// filled, the rest outlined with the map and left out without it. The doors of the rooms drawn show their lock kind
// (§6.5's legend) and, with the compass, the chests and the boss room's mark show (GAME-3D.1f part 5). Metres, with
// north (+z) up. Presentation.
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { ENEMIES } from '../constants/enemies.ts'
import type { Area } from '../systems/index.ts'

/** A full turn in the sim's turn units. */
const TURN = 65_536

export type RoomState = 'here' | 'visited' | 'outline'

export interface PlanRect {
  readonly minX: number
  readonly minZ: number
  readonly maxX: number
  readonly maxZ: number
}

/** A door on the map: its box, its lock kind, open or not, and for a switch door the place of its switch. */
export interface MapDoor extends PlanRect {
  readonly id: string
  readonly lock: 'none' | 'small-key' | 'boss-key' | 'clear' | 'switch'
  readonly open: boolean
  readonly link?: { readonly x: number; readonly z: number }
}

export interface MapPlan {
  /** Every room's box together, drawn or not, so the plan keeps its scale as rooms are found. */
  readonly bounds: PlanRect
  readonly rooms: readonly (PlanRect & { readonly id: string; readonly state: RoomState })[]
  readonly walls: readonly PlanRect[]
  readonly doors: readonly MapDoor[]
  /** With the compass: every chest, open or closed. */
  readonly chests: readonly {
    readonly id: string
    readonly x: number
    readonly z: number
    readonly open: boolean
  }[]
  /** With the compass: the boss room's mark, at its centre. */
  readonly boss?: { readonly room: string; readonly x: number; readonly z: number }
  /** Wick's place, and his facing in degrees clockwise from north. */
  readonly wick: { readonly x: number; readonly z: number; readonly facingDeg: number }
  /** The camera's heading, in degrees clockwise from north. */
  readonly headingDeg: number
}

/** What the map knows of the game: Wick's place (Q16.16) and facing, the camera's heading, the visits and the map. */
export interface MapAt {
  readonly x: number
  readonly z: number
  readonly facing: number
  readonly heading: number
  /** The view ids of the rooms visited (the save's `kiln.visited`). */
  readonly visited: readonly string[]
  readonly hasMap: boolean
  readonly hasCompass: boolean
  /** The save's flags (`<area>/<entity id>`): the doors and chests opened. */
  readonly flags: readonly string[]
}

const inMetres = (box: { minX: number; minZ: number; maxX: number; maxZ: number }): PlanRect => ({
  minX: box.minX / Q16,
  minZ: box.minZ / Q16,
  maxX: box.maxX / Q16,
  maxZ: box.maxZ / Q16,
})
const contains = (box: PlanRect, x: number, z: number): boolean =>
  x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ
/** Whether two boxes overlap or share an edge (a wall stands on a room's edge). */
const touches = (a: PlanRect, b: PlanRect): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ
/** The Warden's kind, which marks the boss room. */
const WARDEN = ENEMIES.findIndex((enemy) => enemy.rank === 'warden') + 1
/** A box entity's box from its centre and size, Q16.16 metres. */
const boxOf = (entity: { x: number; z: number; readonly [field: string]: unknown }) => {
  const halfW = Math.trunc((entity.width as number) / 2)
  const halfD = Math.trunc((entity.depth as number) / 2)
  return { minX: entity.x - halfW, minZ: entity.z - halfD, maxX: entity.x + halfW, maxZ: entity.z + halfD }
}
const degrees = (units: number): number => (((units % TURN) + TURN) % TURN) * (360 / TURN)

/** The plan of `area` as the map draws it for `at`. */
export function mapOf(area: Area, at: MapAt): MapPlan {
  const x = at.x / Q16
  const z = at.z / Q16
  const all = area.rooms.map((room) => ({ id: room.view, ...inMetres(room) }))
  const here = all.find((room) => contains(room, x, z))
  const rooms = all.flatMap((room) => {
    const state: RoomState | undefined =
      room === here ? 'here' : at.visited.includes(room.id) ? 'visited' : at.hasMap ? 'outline' : undefined
    return state === undefined ? [] : [{ ...room, state }]
  })
  const walls = area.walls.map(inMetres).filter((wall) => rooms.some((room) => touches(wall, room)))
  const opened = (id: string): boolean => at.flags.includes(`${area.id}/${id}`)
  const doors = area.entities.flatMap((entity): MapDoor[] => {
    if (entity.def !== 'door') return []
    const box = inMetres(boxOf(entity))
    if (!rooms.some((room) => touches(box, room))) return []
    const lock = entity.lock as MapDoor['lock']
    const named = lock === 'switch' ? area.entities.find((other) => other.id === entity.switch) : undefined
    return [
      {
        id: entity.id,
        ...box,
        lock,
        open: opened(entity.id),
        ...(named === undefined ? {} : { link: { x: named.x / Q16, z: named.z / Q16 } }),
      },
    ]
  })
  const chests = at.hasCompass
    ? area.entities
        .filter((entity) => entity.def === 'chest')
        .map((entity) => ({ id: entity.id, x: entity.x / Q16, z: entity.z / Q16, open: opened(entity.id) }))
    : []
  const warden = area.foes.find((foe) => foe.kind === WARDEN)
  const bossRoom =
    warden === undefined ? undefined : all.find((room) => contains(room, warden.x / Q16, warden.z / Q16))
  return {
    bounds: {
      minX: Math.min(...all.map((room) => room.minX)),
      minZ: Math.min(...all.map((room) => room.minZ)),
      maxX: Math.max(...all.map((room) => room.maxX)),
      maxZ: Math.max(...all.map((room) => room.maxZ)),
    },
    rooms,
    walls,
    doors,
    chests,
    ...(at.hasCompass && bossRoom !== undefined
      ? {
          boss: {
            room: bossRoom.id,
            x: (bossRoom.minX + bossRoom.maxX) / 2,
            z: (bossRoom.minZ + bossRoom.maxZ) / 2,
          },
        }
      : {}),
    wick: { x, z, facingDeg: degrees(at.facing) },
    headingDeg: degrees(at.heading),
  }
}
