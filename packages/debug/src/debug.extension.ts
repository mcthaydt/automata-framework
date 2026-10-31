// `debug` as an extension a game opts into (M6 spec §4.2), in dev and `--debug` builds only: a game adds it behind the build
// constant (`__AUTOMATA_DEBUG__ ? [debugExtension] : []`) so a release build tree-shakes it (M6-D13, DB-b). The overlay draws in
// `hud.overlay`; it takes its panels from the host the game installs (DBG-D1).
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import DebugOverlay from './DebugOverlay.svelte'

export const debugExtension: ExtensionDef<'debug'> = defineExtension({
  name: 'debug',
  ui: { slots: { 'hud.overlay': DebugOverlay } },
})
