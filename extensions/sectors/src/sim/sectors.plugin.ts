// The sectors plugin (M6 spec §4.3): the `sector-map` resource, the `in-sector` component, the `sector.entered` and
// `zone.crossed` events, and the membership system.
import { definePlugin, type PluginDef } from '@automata/sim'
import { InSector } from './sectors.component'
import { SectorEntered, ZoneCrossed } from './sectors.event'
import { SectorMapResource } from './sectors.resource'
import { sectorMembershipSystem } from './sectors.system'

export const sectorsPlugin: PluginDef = definePlugin({
  name: 'sectors',
  components: [InSector],
  resources: [SectorMapResource],
  events: [SectorEntered, ZoneCrossed],
  systems: [sectorMembershipSystem],
})
