// `systems` as an extension a game opts into: the plugin (with the game's options) and the `systems` content kind,
// whose hook check uses the same hook names. It needs `sectors`, `nav` and `puzzle`.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { createSystems, type Systems } from './sim/systems.plugin'
import type { SystemsOptions } from './sim/world'
import { systemsContent } from './systems.content'

export interface SystemsExtension extends Systems {
  readonly extension: ExtensionDef<'systems'>
}

export function systemsExtension(options: SystemsOptions = {}): SystemsExtension {
  const systems = createSystems(options)
  return {
    ...systems,
    extension: defineExtension({
      name: 'systems',
      requires: ['sectors', 'nav', 'puzzle'],
      sim: [systems.plugin],
      content: [systemsContent({ hooks: Object.keys(options.hooks ?? {}).sort() })],
    }),
  }
}
