// A scene change: the game's Flow hands the new scene's level to the sim, which replaces the old one. Every
// walker's membership is cleared, so the next membership pass enters each walker into the new level's sectors.
import { pathText } from '@automata/3d/level'
import { type SimContext, sortedKeys } from '@automata/sim'
import { checkLevel, type SectorMap, type StoredPlane } from './check-level'
import { InSector } from './sectors.component'
import { SectorMapResource } from './sectors.resource'

/** A plane that is only a height is kept as the number: the stored form is what a snapshot hashes. */
const flat = (plane: StoredPlane): StoredPlane =>
  typeof plane !== 'number' && sortedKeys(plane).length === 1 ? plane.z : plane

/**
 * Makes `level` the scene's map; only its sectors and masses are kept. Call it from a game system. A level
 * `checkLevel` reports on throws, naming the first fault: the game checks its levels when it builds, so a sim that
 * meets one has a bug to stop at.
 */
export function loadSectorMap(ctx: SimContext, level: SectorMap): void {
  const [problem] = checkLevel(level)
  if (problem !== undefined) throw new Error(`${pathText(problem.path)}: ${problem.message}`)
  // A system owns the resource it changes; the readonly map type is for its readers.
  const resource = ctx.resource(SectorMapResource) as {
    sectors: SectorMap['sectors']
    masses?: SectorMap['masses']
  }
  resource.sectors = level.sectors.map((sector) => ({
    ...sector,
    floor: flat(sector.floor),
    ceiling: flat(sector.ceiling),
  }))
  // A resource must round-trip through canonical JSON, which has no undefined: no masses is no member.
  if (level.masses === undefined) delete resource.masses
  else resource.masses = level.masses
  for (const walker of ctx.query(InSector)) walker.set(InSector, { sector: 0 })
}
