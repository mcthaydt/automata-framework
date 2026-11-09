// base-3d's HUD (DESIGN.md §9.5, GAME-3D.1e part 5a), as an extension filling the play screen's `hud.overlay` slot.
import { defineExtension, type ExtensionDef } from '@automataframework/automata/extension'
import Hud from './Hud.svelte'

export const hudExtension: ExtensionDef<'base-3d-hud'> = defineExtension({
  name: 'base-3d-hud',
  ui: { slots: { 'hud.overlay': Hud } },
})
