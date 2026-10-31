// What an area starts with besides Wick (DESIGN.md §8.2, §13): its training dummies and its foes. Sim code.
import type { SpawnPart } from '@mcthaydt/automata-sim'
import { Enemy, Fighter, Target } from '../components.ts'
import { enemyOf } from '../constants/enemies.ts'
import { DUMMY, DUMMY_FACING } from '../constants/index.ts'
import type { Area, AreaFoe } from './area.ts'

/**
 * The entities an area starts with besides Wick: a training dummy at each target point, and its foes (DESIGN.md
 * §8.2), each with its type's fighter and an idle brain at home. `spawnArea` (state/index.ts) and the area swap spawn them.
 */
export function spawnFoes(area: Area): SpawnPart[][] {
  const dummies = area.targets.map(({ x, z }): SpawnPart[] => [
    [Target, { x, z, facing: DUMMY_FACING }],
    [Fighter, { side: 1, ...DUMMY }],
  ])
  return [...dummies, ...area.foes.map(foeParts)]
}

/** One foe as spawn parts: its type's fighter, a `target` row (so it is lockable) and an idle brain at home. */
export function foeParts({ kind, x, z, facing }: AreaFoe): SpawnPart[] {
  const { health = 1, radius = 0, height = 0, lift = 0 } = enemyOf(kind) ?? {}
  return [
    [Target, { x, z, facing }],
    [Fighter, { side: 1, health, radius, height, lift }],
    [Enemy, { kind, homeX: x, homeZ: z, homeFacing: facing }],
  ]
}
