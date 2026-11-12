import type { UiComponent } from '@automataframework/framework/extension'
import type { LineRecord } from '../../shared/sim/lines.schema.ts'
import DialogueBox from './DialogueBox.svelte'
import type { TypingOptions } from './typing.ts'

/**
 * The dialogue box as a `hud.overlay` component. A slot component takes no props, so the game's words and line records
 * are closed over here and handed to the box when the play screen draws it. `typing` sets the clock and rate lines with a
 * delivery are typed at.
 */
export function dialogueBoxSlot(
  words: (key: string) => string | undefined,
  lines: (id: string) => LineRecord | undefined,
  typing: TypingOptions = {},
): UiComponent {
  return ((anchor, props) => DialogueBox(anchor, { ...props, words, lines, typing })) as UiComponent
}
