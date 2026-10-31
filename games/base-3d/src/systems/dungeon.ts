// The dungeon pieces in the sim (DESIGN.md §10, GAME-3D.1f): spawned from the area's entities. Part 1: the sling
// targets. Sim code.
import type { SpawnPart } from '@mcthaydt/automata-sim'
import { Fighter, SlingTarget, Target } from '../components.ts'
import { SLING_TARGET } from '../constants/index.ts'
import type { Area } from './area.ts'

/**
 * The pieces an area starts with: each `sling-target` as a lockable target whose hurt cylinder is centred on its
 * height (§9.2's aim rises to a candidate's middle), on the foes' side so a pellet lands on it. `spawnFoes` adds them
 * to what an area spawns.
 */
export function spawnPieces(area: Area): SpawnPart[][] {
  return area.entities.flatMap((entity, index): SpawnPart[][] => {
    if (entity.def !== 'sling-target') return []
    const height = entity.height as number
    return [
      [
        [Target, { x: entity.x, z: entity.z, facing: 0 }],
        [Fighter, { side: 1, ...SLING_TARGET, lift: height - Math.trunc(SLING_TARGET.height / 2) }],
        [SlingTarget, { piece: index + 1 }],
      ],
    ]
  })
}
