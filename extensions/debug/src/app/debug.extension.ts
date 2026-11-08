// `debug` as an extension a game opts into, in dev and `--debug` builds only: a game adds it behind the build
// constant (`__AUTOMATA_DEBUG__ ? [debugExtension] : []`) so a release build tree-shakes it. The overlay draws in
// `hud.overlay`; it takes its panels from the host the game installs.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import DebugOverlay from '../features/overlay/DebugOverlay.svelte'

/**
 * The debug extension a game opts into in dev and `--debug` builds only. It draws the overlay in
 * `hud.overlay`, with the panels from the host the game installed. Add it behind
 * `__AUTOMATA_DEBUG__` so a release build leaves it out.
 */
export const debugExtension: ExtensionDef<'debug'> = defineExtension({
  name: 'debug',
  ui: { slots: { 'hud.overlay': DebugOverlay } },
})
