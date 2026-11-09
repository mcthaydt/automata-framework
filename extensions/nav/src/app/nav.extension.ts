// `nav` as an extension a game opts into: the sim plugin and the `nav-graph` content kind. It needs whatever provides the
// game's places: `sectors` in a 3D game (the default), `level-2d` in a 2D one.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sectorsPlaces } from '@automata/sectors/sim'
import { navGraphContent } from '../shared/nav-graph.content'
import { createNavPlugin } from '../shared/sim/nav.plugin'
import type { NavOptions } from '../shared/sim/nav.system'

/** Nav for a game's own places and movement query. `navExtension` is this with sectors' 3D rooms. */
export function createNavExtension(options: NavOptions = {}): ExtensionDef<'nav'> {
  return defineExtension({
    name: 'nav',
    requires: [(options.places ?? sectorsPlaces).provider],
    sim: [createNavPlugin(options)],
    content: [navGraphContent],
  })
}

export const navExtension: ExtensionDef<'nav'> = createNavExtension()
