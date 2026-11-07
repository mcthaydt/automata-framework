// A scene change (M6 spec §5): the game's Flow hands the new scene's map to the sim, which replaces the old one. Every
// walker's membership is cleared, so the next membership pass enters each walker into the new map's sectors.
import type { SimContext } from '@mcthaydt/automata-sim'
import { type SectorMap, sectorMapSchema } from './sector-map.schema'
import { InSector } from './sectors.component'
import { SectorMapResource } from './sectors.resource'

/** Makes `map` the scene's map. Call it from a game system; a map that fails `sectorMapSchema` throws. */
export function loadSectorMap(ctx: SimContext, map: SectorMap): void {
  const checked = sectorMapSchema.parse(map)
  // A system owns the resource it changes; the readonly map type is for its readers.
  const resource = ctx.resource(SectorMapResource) as {
    sectors: SectorMap['sectors']
    masses?: SectorMap['masses']
  }
  resource.sectors = checked.sectors
  // A resource must round-trip through canonical JSON, which has no undefined: no masses is no member.
  if (checked.masses === undefined) delete resource.masses
  else resource.masses = checked.masses
  for (const walker of ctx.query(InSector)) walker.set(InSector, { sector: 0 })
}
