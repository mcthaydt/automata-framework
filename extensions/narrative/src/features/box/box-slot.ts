import type { UiComponent } from '@automata/framework/extension'
import type { LineRecord } from '../../shared/sim/lines.schema.ts'
import DialogueBox from './DialogueBox.svelte'

/**
 * The dialogue box as a `hud.overlay` component. A slot component takes no props, so the game's words and line records
 * are closed over here and handed to the box when the play screen draws it.
 */
export function dialogueBoxSlot(
  words: (key: string) => string | undefined,
  lines: (id: string) => LineRecord | undefined,
): UiComponent {
  return ((anchor, props) => DialogueBox(anchor, { ...props, words, lines })) as UiComponent
}
