// The content check over a compiled world (G3-p, DESIGN.md §9.2, §10; GAME-3D.1f part 5): what the schema cannot see
// in one entity. Every sling target stands 0.5 to 3 m up (the aim's band); every hook post has a floor within the
// chain's reach in plan with a clear line to it; and every door's lock names something that opens it: a small-key door
// a small key in a chest (as many keys as doors in the world), the boss door the boss key, a clear door a foe standing
// in its rooms. `base3dSim` runs it at boot, and the content test over every shipped area.
import { metres } from '../constants/index.ts'
import { HOOKCHAIN } from '../constants/items.ts'
import type { Area, AreaEntity, PlanBox, PlanPoint, World } from './area.ts'
import { lineOfSight } from './lock-target.ts'

/** One fault the check found: the area, the JSON path of the entity (or its field) and the rule it breaks. */
export interface AreaIssue {
  readonly area: string
  readonly path: string
  readonly rule: 'sling-target-height' | 'hook-post-reach' | 'door-lock'
}

/** A sling target's band (§9.2), Q16.16 metres. */
const LOWEST = metres(0.5)
const HIGHEST = metres(3)
/** The floor is sampled at the centres of this grid's cells when looking for a place to throw the chain from. */
const FLOOR_STEP = metres(0.5)

const inside = (box: PlanBox, x: number, z: number): boolean =>
  x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ

/**
 * Whether some floor point (a cell centre in a room, in no pit or wall, edges included) lies within the chain's range
 * of `post` with a clear line to it.
 */
function postReachable(area: Area, post: PlanPoint): boolean {
  const reach = HOOKCHAIN.range * HOOKCHAIN.range
  for (const room of area.rooms)
    for (let x = room.minX + FLOOR_STEP / 2; x < room.maxX; x += FLOOR_STEP)
      for (let z = room.minZ + FLOOR_STEP / 2; z < room.maxZ; z += FLOOR_STEP) {
        const dx = x - post.x
        const dz = z - post.z
        if (dx * dx + dz * dz > reach) continue
        if (area.pits.some((pit) => inside(pit, x, z))) continue
        if (area.walls.some((wall) => inside(wall, x, z))) continue
        if (lineOfSight(area.walls, { x, z }, post)) return true
      }
  return false
}

/** Whether a foe of the area stands in a room holding `door`'s centre (a clear door's rule, §10). */
const foeToClear = (area: Area, door: AreaEntity): boolean =>
  area.rooms
    .filter((room) => inside(room, door.x, door.z))
    .some((room) => area.foes.some((foe) => inside(room, foe.x, foe.z)))

/** Every fault in `world`, area by area and entity by entity; none for content the game can play. */
export function checkWorld(world: World): AreaIssue[] {
  const chests = world.areas.flatMap((area) => area.entities.filter((entity) => entity.def === 'chest'))
  const smallKeys = chests.filter((chest) => chest.contents === 'small-key').length
  const bossKey = chests.some((chest) => chest.contents === 'boss-key')
  let smallDoors = 0
  const issues: AreaIssue[] = []
  for (const area of world.areas)
    area.entities.forEach((entity, index) => {
      const at = `entities[${index}]`
      const issue = (path: string, rule: AreaIssue['rule']) => issues.push({ area: area.id, path, rule })
      if (entity.def === 'sling-target') {
        const height = entity.height as number
        if (height < LOWEST || height > HIGHEST) issue(`${at}.height`, 'sling-target-height')
      } else if (entity.def === 'hook-post') {
        if (!postReachable(area, entity)) issue(at, 'hook-post-reach')
      } else if (entity.def === 'door') {
        // The keys count across the world (§6.5: keys are per dungeon), so the doors beyond the keys are named.
        if (entity.lock === 'small-key') smallDoors += 1
        const opens =
          entity.lock === 'small-key'
            ? smallDoors <= smallKeys
            : entity.lock === 'boss-key'
              ? bossKey
              : entity.lock === 'clear'
                ? foeToClear(area, entity)
                : true
        if (!opens) issue(`${at}.lock`, 'door-lock')
      }
    })
  return issues
}
