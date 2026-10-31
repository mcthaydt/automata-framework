// Membership, last in the step (the `cleanup` phase) so it sees every position the step wrote: each walker's sector,
// in entity order, and the events when it changes.
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { resolvedMap } from './resolved-map'
import { InSector } from './sectors.component'
import { SectorEntered, ZoneCrossed } from './sectors.event'

export const sectorMembershipSystem: SystemDef = defineSystem('sectors.membership', 'cleanup', (ctx) => {
  const map = resolvedMap(ctx)
  for (const walker of ctx.query(InSector)) {
    const { x, z, sector: was } = walker.get(InSector)
    const here = map.sectorAt({ x, z })
    const now = here === undefined ? 0 : map.sectors.indexOf(here) + 1
    if (now === was) continue
    walker.set(InSector, { sector: now })
    if (here === undefined) continue
    const before = was === 0 ? undefined : map.sectors[was - 1]
    ctx.emit(SectorEntered, { entity: walker.sid, sector: here.id, from: before?.id ?? null })
    if (before?.zone !== here.zone)
      ctx.emit(ZoneCrossed, { entity: walker.sid, zone: here.zone, from: before?.zone ?? null })
  }
})
