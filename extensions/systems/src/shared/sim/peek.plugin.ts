// The peek plugin, opt-in: a game that wants peeking adds it beside `systems`. It is a plugin of its own, and not part of
// `systems`, so a sim without it keeps the snapshot header (every plugin's schemas are hashed into it) it always had.
import { sectorsPlaces } from '@automata/sectors/sim'
import { definePlugin, type PluginDef, type SimContext } from '@automata/sim'
import { holds, type PeekState } from './peek'
import { SystemsPeek } from './peek.event'
import { SystemsPeekState } from './peek.resource'
import { defOf, type PeekOptions, peekSystem } from './peek.system'

/** The peek plugin for a game's facing, doors and numbers. Needs `systems` (the player and whether she hides). */
export function createPeek(options: PeekOptions): PluginDef {
  return definePlugin({
    name: 'peek',
    dependsOn: ['systems', 'puzzle', (options.places ?? sectorsPlaces).provider],
    config: {
      ...defOf(options),
      blocked: options.blocked !== undefined,
      interrupt: options.interrupt !== undefined,
    },
    resources: [SystemsPeekState],
    events: [SystemsPeek],
    systems: [peekSystem(options)],
  })
}

/**
 * The player's peek now once it holds, or undefined (the dwell before it holds is not shown). The view hands its `x` and `z`
 * to the play camera's `clampPeek`. A context and a `Sim` both can be asked.
 */
export function peekOf(from: Pick<SimContext, 'resource'>): PeekState | undefined {
  const peek = from.resource(SystemsPeekState).peek
  return holds(peek) && peek !== null ? peek : undefined
}
