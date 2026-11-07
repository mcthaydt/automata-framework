// The nav plugin (M6 spec §4.4). `createNavPlugin` takes the game's movement query, for obstacles of its own.
import { definePlugin, type PluginDef } from '@automata/sim'
import { NavDoor, WalkTo } from './nav.command'
import { NavAgent } from './nav.component'
import { NavArrived, NavUnreachable } from './nav.event'
import { NavDoors, NavGraphResource, NavRoutes } from './nav.resource'
import { type NavOptions, navWalkSystem } from './nav.system'

export function createNavPlugin(options: NavOptions = {}): PluginDef {
  return definePlugin({
    name: 'nav',
    dependsOn: ['sectors'],
    config: { blocked: options.blocked !== undefined },
    components: [NavAgent],
    resources: [NavGraphResource, NavDoors, NavRoutes],
    commands: [WalkTo, NavDoor],
    events: [NavArrived, NavUnreachable],
    systems: [navWalkSystem(options)],
  })
}

/** Nav with sectors' walls and nav's doors as the only obstacles. */
export const navPlugin: PluginDef = createNavPlugin()
