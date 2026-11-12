// `interact` as an extension a game opts into: using a hotspot, which walks the player there and acts on arrival. It
// needs `nav` (to walk) and `puzzle` (the verbs it acts with).
import { defineExtension, type ExtensionDef } from '@automataframework/framework/extension'
import { createInteract, type Interact } from '../shared/sim/interact.plugin'
import type { InteractOptions } from '../shared/sim/interact-options'

/** Interact for a game's player and facts; the `extension` goes in the game's list, `load` and `inReach` are the game's to call. */
export function interactExtension(
  options: InteractOptions,
): Interact & { readonly extension: ExtensionDef<'interact'> } {
  const interact = createInteract(options)
  return {
    ...interact,
    extension: defineExtension({ name: 'interact', requires: ['nav', 'puzzle'], sim: [interact.plugin] }),
  }
}
