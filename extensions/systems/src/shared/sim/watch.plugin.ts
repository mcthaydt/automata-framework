// A run's watcher: checks a scenario's condition with the systems' own probes at the end of every step and
// keeps whether it held. Bots and the pipeline add it to a run's sim; a game never registers it.
import { definePlugin, defineSystem, type PluginDef } from '@automata/sim'
import { holds, type Subject } from './probe'
import type { Probe } from './systems.schema'
import { SystemsWatch } from './watch.resource'
import { type SystemsOptions, worldOf } from './world'

/**
 * A watcher for `when`, asked as agent `as` (with its senses) or as a world rule. It runs in `cleanup`, after the
 * systems' step, with the game's options (its derived facts).
 */
export function createWatch(options: SystemsOptions, when: readonly Probe[], as?: string): PluginDef {
  return definePlugin({
    name: 'systems-watch',
    dependsOn: ['systems'],
    resources: [SystemsWatch],
    systems: [
      defineSystem('systems-watch.check', 'cleanup', (ctx) => {
        const w = worldOf(ctx, options)
        const watch = ctx.resource(SystemsWatch)
        if (w === undefined) {
          watch.held = false
          return
        }
        const def = as === undefined ? undefined : w.defs[as]
        const subject: Subject = def === undefined ? { id: null, clock: 0 } : { id: def.id, def }
        watch.held = holds(w, when, subject)
      }),
    ],
  })
}
