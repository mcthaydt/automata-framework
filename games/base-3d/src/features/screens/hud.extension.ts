// base-3d's HUD, as an extension filling the play screen's `hud.overlay` slot.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import Hud from './Hud.svelte'

export const hudExtension: ExtensionDef<'base-3d-hud'> = defineExtension({
  name: 'base-3d-hud',
  ui: { slots: { 'hud.overlay': Hud } },
})
