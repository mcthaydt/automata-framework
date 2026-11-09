import type { UiComponent } from '@automata/framework/extension'
import type { CutsceneScript } from '../../shared/sim/cutscene.schema.ts'
import Caption from './Caption.svelte'
import type { CaptionLine } from './caption.ts'

/**
 * The caption as a `hud.overlay` component. A slot component takes no props, so the game's words, line records and
 * scripts are closed over here and handed to the caption when the play screen draws it.
 */
export function captionSlot(
  words: (key: string) => string | undefined,
  lines: (id: string) => CaptionLine | undefined,
  scripts: Readonly<Record<string, CutsceneScript>>,
  tickHz = 60,
): UiComponent {
  return ((anchor, props) => Caption(anchor, { ...props, words, lines, scripts, tickHz })) as UiComponent
}
