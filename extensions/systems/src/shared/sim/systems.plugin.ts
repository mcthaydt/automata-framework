// The systems plugin. `createSystems` takes the game's hooks, derived facts, refused steps, mapped
// facts and queries, and gives the plugin with the `hear` and `load` bound to those options.
import type { PlanPoint as Point } from '@automata/places'
import { sectorsPlaces } from '@automata/sectors/sim'
import { definePlugin, type PluginDef, type SimContext, sortedKeys } from '@automata/sim'
import { loadSystems } from './load-systems'
import { Hide, Unhide } from './systems.command'
import { SystemsAgent } from './systems.component'
import { SystemsCaught, SystemsCutscene, SystemsLine, SystemsMode, SystemsNoise } from './systems.event'
import { SystemsEnv, SystemsNoises, SystemsPursuit, SystemsScene, SystemsState } from './systems.resource'
import type { SystemsDef } from './systems.schema'
import { hearWith, systemsNoiseAgeSystem, systemsStepSystem } from './systems.system'
import type { SystemsOptions } from './world'

export interface Systems {
  readonly plugin: PluginDef
  /** Makes a noise from a sim system; give it to puzzle's `noise` option. */
  readonly hear: (
    ctx: SimContext,
    noise: { readonly at: Point; readonly loudness: number; readonly kind: string },
  ) => void
  /** Loads a scene's systems; call it from a game system after its map and nav graph. */
  readonly load: (ctx: SimContext, def: SystemsDef, places?: Readonly<Record<string, Point>>) => void
}

export function createSystems(options: SystemsOptions = {}): Systems {
  return {
    plugin: definePlugin({
      name: 'systems',
      dependsOn: [(options.places ?? sectorsPlaces).provider, 'nav', 'puzzle'],
      config: {
        hooks: sortedKeys(options.hooks ?? {}),
        derived: sortedKeys(options.derived ?? {}),
        refuses: options.refuses !== undefined,
        facts: options.facts !== undefined,
        blocked: options.blocked !== undefined,
        sight: options.sight !== undefined,
      },
      components: [SystemsAgent],
      resources: [SystemsScene, SystemsState, SystemsNoises, SystemsPursuit, SystemsEnv],
      commands: [Hide, Unhide],
      events: [SystemsMode, SystemsNoise, SystemsCaught, SystemsCutscene, SystemsLine],
      systems: [systemsStepSystem(options), systemsNoiseAgeSystem],
    }),
    hear: hearWith(options),
    load: (ctx, def, places) => loadSystems(ctx, def, options, places),
  }
}

/** Systems with no hooks or derived facts, and nav's and sectors' default queries. */
export const systems: Systems = createSystems()
