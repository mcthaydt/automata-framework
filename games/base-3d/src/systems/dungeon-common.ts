// What the dungeon's systems share (DESIGN.md §10, GAME-3D.1f): a piece's box and saved id, the sorted flag list, and
// the plan tests for a point in a box, two boxes overlapping, Wick's square and his reach. Sim code.
import { DOOR_REACH, HERO_HALF } from '../constants/index.ts'
import type { Area, AreaEntity, PlanBox } from './area.ts'

/** A box entity's plan box, from its centre and size (Q16.16 metres). */
export function boxOf(entity: AreaEntity): { minX: number; minZ: number; maxX: number; maxZ: number } {
  const halfW = Math.trunc((entity.width as number) / 2)
  const halfD = Math.trunc((entity.depth as number) / 2)
  return { minX: entity.x - halfW, minZ: entity.z - halfD, maxX: entity.x + halfW, maxZ: entity.z + halfD }
}

/** A piece's saved id: `<area>/<entity id>`. */
export const flagOf = (area: Area, entity: AreaEntity): string => `${area.id}/${entity.id}`

/** Adds `flag` to the sorted `flags`, once. */
export function addFlag(flags: string[], flag: string): void {
  if (flags.includes(flag)) return
  flags.push(flag)
  flags.sort()
}

/** Whether `point` lies in `box` (edges included). */
export const inside = (box: PlanBox, x: number, z: number): boolean =>
  x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ
/** Whether two boxes overlap (touching faces do not). */
export const overlaps = (a: PlanBox, b: PlanBox): boolean =>
  a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ
/** Wick's square at his place. */
export const heroBox = (x: number, z: number): PlanBox => ({
  minX: x - HERO_HALF,
  minZ: z - HERO_HALF,
  maxX: x + HERO_HALF,
  maxZ: z + HERO_HALF,
})

/** Whether Wick's square, grown by `DOOR_REACH`, touches `box`. */
export const inReach = (
  box: { minX: number; minZ: number; maxX: number; maxZ: number },
  x: number,
  z: number,
): boolean => {
  const grow = HERO_HALF + DOOR_REACH
  return x + grow >= box.minX && x - grow <= box.maxX && z + grow >= box.minZ && z - grow <= box.maxZ
}
