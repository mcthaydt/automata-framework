// A run's watcher (M6.7b): checks a scenario's condition with the systems' own probes at the end of every step and
// keeps whether it held. Bots and the pipeline add it to a run's sim; a game never registers it.
import { definePlugin, defineResource, defineSystem, type PluginDef, type ResourceDef } from '@automata/sim'
import { z } from 'zod'
import { holds, type Subject } from './probe'
import type { Probe } from './systems.schema'
import { type SystemsOptions, worldOf } from './world'

const watchSchema: z.ZodType<{ held: boolean }> = z.strictObject({ held: z.boolean() })
/** Whether the watched condition held at the end of the last step. */
export const SystemsWatch: ResourceDef<typeof watchSchema> = defineResource(
  'systems.watch',
  watchSchema,
  () => ({
    held: false,
  }),
)

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
