import { NavGraphResource } from '@automata/nav/sim'
import { InSector, sectorsPlaces } from '@automata/sectors/sim'
import type { SimContext } from '@automata/sim'
import { SystemsState } from '@automata/systems/sim'
import { Ada } from '../shared/ada.component.ts'
import type { PlayContent } from '../shared/play-content.ts'

/**
 * Where a name a cutscene uses stands now: `player` (Ada), `actor:<who>` (a character of the creature's file), a hotspot, or
 * a node of the walking graph. A name the scene lacks is undefined, which a cutscene reports as missing (and ends at once).
 */
export const anchorsOf =
  (play: PlayContent) =>
  (ctx: SimContext, name: string): { readonly x: number; readonly z: number } | undefined => {
    if (name === 'player') {
      const [ada] = ctx.query(Ada, InSector)
      return ada === undefined ? undefined : ada.get(InSector)
    }
    if (name.startsWith('actor:')) {
      const record = ctx.resource(SystemsState).agents[name.slice('actor:'.length)]
      return record === undefined ? undefined : sectorsPlaces.at(ctx, record.sid)
    }
    const spot = play.hotspots.find((hotspot) => hotspot.id === name)
    if (spot !== undefined) return { x: spot.x, z: spot.z }
    return ctx.resource(NavGraphResource).nodes[name]
  }
