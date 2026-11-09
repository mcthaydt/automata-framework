// `systems` as an extension a game opts into: the plugin (with the game's options) and the `systems` content kind,
// whose hook check uses the same hook names. It needs whatever provides the places (`sectors` in 3D), `nav` and `puzzle`.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sectorsPlaces } from '@automata/sectors/sim'
import { createSystems, type Systems } from '../shared/sim/systems.plugin'
import type { SystemsOptions } from '../shared/sim/world'
import { systemsContent } from '../shared/systems.content'

export interface SystemsExtension extends Systems {
  readonly extension: ExtensionDef<'systems'>
}

export function systemsExtension(options: SystemsOptions = {}): SystemsExtension {
  const systems = createSystems(options)
  return {
    ...systems,
    extension: defineExtension({
      name: 'systems',
      requires: [(options.places ?? sectorsPlaces).provider, 'nav', 'puzzle'],
      sim: [systems.plugin],
      content: [systemsContent({ hooks: Object.keys(options.hooks ?? {}).sort() })],
    }),
  }
}
