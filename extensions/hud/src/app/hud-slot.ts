import type { UiComponent } from '@automataframework/framework/extension'
import type { HudOptions } from '../shared/hud-model'
import HudRoot from './HudRoot.svelte'

/**
 * The whole play HUD as one `hud.overlay` component. A slot component takes no props, so the game's file, words, model and
 * actions are closed over here and handed to the HUD when the play screen draws it.
 */
export function hudSlot(options: HudOptions): UiComponent {
  return ((anchor, props) => HudRoot(anchor, { ...props, options })) as UiComponent
}
