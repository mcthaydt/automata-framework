import type { View } from '../../shared/sim/dialogue.ts'
import type { LineRecord } from '../../shared/sim/lines.schema.ts'

// The dialogue box's words. The sim holds line ids and locale keys, never text; the box turns the conversation's current
// view into what the player reads, from the game's line records and its message catalog. A key is never shown to a
// player: a line with no words shows as an empty line and is listed in `missing`, so the box can report it.

/** What the box draws for one view of a conversation. */
export interface BoxModel {
  readonly speaker: string
  readonly text: string
  /** Whether "Next" is on offer: when there are no choices, even on the last line (it ends the conversation). */
  readonly next: boolean
  /** By the index the sim's `narrative.choose` takes, in the order the node lists them. */
  readonly choices: readonly { readonly index: number; readonly text: string }[]
  /** Line ids that have no record or no words, in the order met. */
  readonly missing: readonly string[]
  /** Speaker ids the game gave no name (`speaker.<id>`), at most one: the speaker is then shown with no name. */
  readonly missingSpeakers: readonly string[]
}

/** The CSS variable the box sets on the play field to its own height, so a caption sits above it. */
export const BOX_HEIGHT_VAR = '--af-dialogue-box-height'

/**
 * What the box shows for `view`, or null when no conversation is under way. `fallbackSpeaker` is the graph's speaker,
 * used where the line names none. A speaker is shown as `words('speaker.<id>')`; a game that has not named one shows no name
 * (an id is never read to a player) and `missingSpeakers` says which, so the box can tell whoever writes the game.
 */
export function dialogueBoxModel(
  view: View | null,
  lines: (id: string) => LineRecord | undefined,
  words: (key: string) => string | undefined,
  fallbackSpeaker: string,
): BoxModel | null {
  if (view === null) return null
  const missing: string[] = []
  const textOf = (id: string): string => {
    const text = words(lines(id)?.text ?? '')
    if (text === undefined) {
      if (!missing.includes(id)) missing.push(id)
      return ''
    }
    return text
  }
  const spoke = view.line === null ? undefined : lines(view.line)?.speaker
  const speaker = spoke ?? fallbackSpeaker
  const text = view.line === null ? '' : textOf(view.line)
  const choices = view.choices.map((choice) => ({ index: choice.index, text: textOf(choice.line) }))
  const name = words(`speaker.${speaker}`)
  return {
    speaker: name ?? '',
    text,
    next: choices.length === 0,
    choices,
    missing,
    missingSpeakers: name === undefined && speaker !== '' ? [speaker] : [],
  }
}
