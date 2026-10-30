// The Last Light blockout as a level profile: the codec, the geometry of the sectors its expansion gives (with the nav
// world its clearance queries read), Last Light's own checks, the fixed things its arrays hold, and its nav edges as links.
import { lastLightChecks } from '../checks/last-light/last-light-checks'
import type { Blockout } from '../format/blockout.schema'
import { BlockoutError, type Expanded, expand } from '../format/expand'
import { navWorld } from '../geometry/nav'
import { blockoutCodec } from './last-light-codecs'
import { lastLightEntityKit } from './last-light-entities'
import { lastLightNavLinks } from './last-light-nav-links'
import { lastLightSectorAccess } from './last-light-sectors'
import { lastLightThingAccess } from './last-light-things'
import { GeometryError, type LevelProfile, resolveOrThrow } from './level-profile'

export const lastLightProfile: LevelProfile<Blockout> = {
  ...blockoutCodec,
  geometry(blockout) {
    let expanded: Expanded
    try {
      expanded = expand(blockout)
    } catch (error) {
      if (error instanceof BlockoutError) throw new GeometryError(error.message)
      throw error
    }
    const map = resolveOrThrow(expanded.sectors, expanded.masses)
    return { layers: [{ kind: 'sectors', map, nav: navWorld(map, expanded) }] }
  },
  checks: (blockout, context) => lastLightChecks(blockout, context),
  entities: lastLightEntityKit,
  sectors: lastLightSectorAccess,
  things: lastLightThingAccess,
  links: lastLightNavLinks,
}
