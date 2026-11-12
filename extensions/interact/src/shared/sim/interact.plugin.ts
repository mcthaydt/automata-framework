// The interact plugin. `createInteract` takes the game's player, reader and hide hook, and gives the plugin with `load`
// and `inReach` bound to them.
import { holds } from '@automataframework/puzzle/sim'
import { definePlugin, type PluginDef, type SimContext } from '@automataframework/sim'
import type { Hotspot } from './hotspot.schema'
import { Cancel, Combine, EnterCode, Use } from './interact.command'
import { InteractPending, InteractRefused, InteractUsed } from './interact.event'
import { InteractState } from './interact.resource'
import { interactSystem } from './interact.system'
import type { InteractOptions, SimView } from './interact-options'
import { nearestInReach } from './pending'

export interface Interact {
  readonly plugin: PluginDef
  /** Sets the level's hotspots, and forgets any waiting use; call it from a game system when a level loads. */
  readonly load: (ctx: SimContext, hotspots: readonly Hotspot[]) => void
  /** The hotspots within reach of the player now and usable, nearest first: what the prompt shows. */
  readonly inReach: (view: SimView) => readonly Hotspot[]
}

export function createInteract(options: InteractOptions): Interact {
  return {
    plugin: definePlugin({
      name: 'interact',
      dependsOn: ['nav', 'puzzle'],
      config: { hide: options.hide !== undefined },
      resources: [InteractState],
      commands: [Use, Combine, EnterCode, Cancel],
      events: [InteractPending, InteractRefused, InteractUsed],
      systems: [interactSystem(options)],
    }),
    load(ctx, hotspots) {
      const state = ctx.resource(InteractState)
      state.hotspots = hotspots.map((h) => ({ ...h }))
      state.pending = null
    },
    inReach(view) {
      const player = options.player(view)
      if (player === undefined) return []
      const reader = options.reader(view)
      const usable = view
        .resource(InteractState)
        .hotspots.filter((spot) => (spot.when ?? []).every((c) => holds(reader, { at: spot.id }, c)))
      return nearestInReach(player, usable)
    },
  }
}
