// The dungeon pieces in the sim (DESIGN.md §10, GAME-3D.1f): spawned from the area's entities, opened, and saved by
// id in the `Dungeon` resource. Part 1: the sling targets. Part 2: doors and keys, and the rooms visited. Sim code.
import { defineSystem, type SimContext, type SpawnPart, type SystemDef } from '@mcthaydt/automata-sim'
import { Door, Enemy, Fighter, Hero, HeroControl, SlingTarget, Target } from '../components.ts'
import { ACTION_BITS, DOOR_REACH, HERO_HALF, SLING_TARGET } from '../constants/index.ts'
import { DoorOpened } from '../events.ts'
import { Dungeon, Freeze, Location } from '../resources.ts'
import { type Area, type AreaEntity, areaIn } from './area.ts'

/**
 * The pieces an area starts with: each `sling-target` as a lockable target whose hurt cylinder is centred on its
 * height (§9.2's aim rises to a candidate's middle), on the foes' side so a pellet lands on it; and each `door`,
 * closed until `dungeon.doors` finds it saved open. `spawnFoes` adds them to what an area spawns.
 */
export function spawnPieces(area: Area): SpawnPart[][] {
  return area.entities.flatMap((entity, index): SpawnPart[][] => {
    if (entity.def === 'sling-target') {
      const height = entity.height as number
      return [
        [
          [Target, { x: entity.x, z: entity.z, facing: 0 }],
          [Fighter, { side: 1, ...SLING_TARGET, lift: height - Math.trunc(SLING_TARGET.height / 2) }],
          [SlingTarget, { piece: index + 1 }],
        ],
      ]
    }
    if (entity.def === 'door') return [[[Door, { piece: index + 1, open: false, ...boxOf(entity) }]]]
    return []
  })
}

/** A box entity's plan box, from its centre and size (Q16.16 metres). */
function boxOf(entity: AreaEntity): { minX: number; minZ: number; maxX: number; maxZ: number } {
  const halfW = Math.trunc((entity.width as number) / 2)
  const halfD = Math.trunc((entity.depth as number) / 2)
  return { minX: entity.x - halfW, minZ: entity.z - halfD, maxX: entity.x + halfW, maxZ: entity.z + halfD }
}

/** A piece's saved id: `<area>/<entity id>`. */
const flagOf = (area: Area, entity: AreaEntity): string => `${area.id}/${entity.id}`

/** Adds `flag` to the sorted `flags`, once. */
function addFlag(flags: string[], flag: string): void {
  if (flags.includes(flag)) return
  flags.push(flag)
  flags.sort()
}

/** Whether `point` lies in `box` (edges included). */
const inside = (
  box: { minX: number; minZ: number; maxX: number; maxZ: number },
  x: number,
  z: number,
): boolean => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ

/** Whether Wick's square, grown by `DOOR_REACH`, touches `box`. */
const inReach = (
  box: { minX: number; minZ: number; maxX: number; maxZ: number },
  x: number,
  z: number,
): boolean => {
  const grow = HERO_HALF + DOOR_REACH
  return x + grow >= box.minX && x - grow <= box.maxX && z + grow >= box.minZ && z - grow <= box.maxZ
}

/** Whether any living foe stands in a room that holds the door's centre (a `clear` door's rule). */
function foeNear(ctx: SimContext, area: Area, door: AreaEntity): boolean {
  const rooms = area.rooms.filter((room) => inside(room, door.x, door.z))
  return ctx.query(Enemy, Fighter, Target).some((foe) => {
    if (foe.get(Fighter).health <= 0) return false
    const { x, z } = foe.get(Target)
    return rooms.some((room) => inside(room, x, z))
  })
}

/**
 * Opens doors (DESIGN.md §10): a door saved open opens at once; a `clear` door when no living foe stands in its
 * rooms; and on a pick-up press with Wick beside it, a `none` door, a `small-key` door with a key in hand (spent) or
 * the boss door with the boss key (spent). An opened door is saved and announced. `switch` doors follow their switch
 * (part 3). Runs before Wick moves, so a door opened this tick lets him through.
 */
export const dungeonDoors: SystemDef = defineSystem({
  name: 'dungeon.doors',
  phase: 'prePhysics',
  after: ['hero.act'],
  run(ctx) {
    if (ctx.resource(Freeze).active) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    const dungeon = ctx.resource(Dungeon)
    const wick = ctx.query(Hero, HeroControl)[0]
    const pressed = wick !== undefined && (wick.get(HeroControl).actPressed & ACTION_BITS.pickup) !== 0
    const { x, z } = wick?.get(Hero) ?? { x: 0, z: 0 }
    for (const entity of ctx.query(Door)) {
      const door = entity.get(Door)
      const piece = area.entities[door.piece - 1]
      if (door.open || piece === undefined) continue
      const flag = flagOf(area, piece)
      let opens = dungeon.flags.includes(flag)
      if (!opens && piece.lock === 'clear') opens = !foeNear(ctx, area, piece)
      if (!opens && pressed && inReach(door, x, z)) {
        if (piece.lock === 'none') opens = true
        else if (piece.lock === 'small-key' && dungeon.smallKeys > 0) {
          dungeon.smallKeys -= 1
          opens = true
        } else if (piece.lock === 'boss-key' && dungeon.bossKey) {
          dungeon.bossKey = false
          opens = true
        }
      }
      if (!opens) continue
      entity.set(Door, { open: true })
      if (!dungeon.flags.includes(flag)) {
        addFlag(dungeon.flags, flag)
        ctx.emit(DoorOpened, { piece: door.piece })
      }
    }
  },
})

/** Records the room Wick stands in as visited (DESIGN.md §9.4's map), by its view id, sorted. */
export const dungeonVisit: SystemDef = defineSystem({
  name: 'dungeon.visit',
  phase: 'postPhysics',
  after: ['hero.view'],
  run(ctx) {
    const wick = ctx.query(Hero)[0]
    if (wick === undefined) return
    const { x, z } = wick.get(Hero)
    const room = areaIn(ctx.content, ctx.resource(Location)).rooms.find((box) => inside(box, x, z))
    const visited = ctx.resource(Dungeon).visited
    if (room === undefined || visited.includes(room.view)) return
    visited.push(room.view)
    visited.sort()
  },
})
