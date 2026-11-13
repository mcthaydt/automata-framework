// The words at the top of the editors that say whether the work is safe. One pure function, so the same words show in
// the folder editor, in a browser that keeps the game, and in one that keeps nothing.

/** Where a game's files live: the folder `automata editor` serves, this browser's private storage, or nowhere. */
export type Where = 'folder' | 'device' | 'nowhere'

export interface SaveLineInput {
  /** Fields holding typed text plus writes in flight. */
  readonly pending: number
  /** The last write's refusal in words, when it failed. */
  readonly failed?: string | undefined
  readonly where: Where
}

export interface SaveLine {
  readonly state: 'saved' | 'saving' | 'failed'
  readonly words: string
}

// No action is promised: the sample in such a browser has no way to save a copy, so the line says what will happen.
const NOWHERE = 'Not saved: this browser can’t keep your work. It is lost when this page closes.'

export function saveLine(input: SaveLineInput): SaveLine {
  // A browser that keeps nothing never says Saved, whatever is typed: the work is in memory only.
  if (input.where === 'nowhere') return { state: 'failed', words: NOWHERE }
  if (input.failed !== undefined) return { state: 'failed', words: `Not saved: ${input.failed}` }
  if (input.pending > 0) return { state: 'saving', words: 'Saving…' }
  return {
    state: 'saved',
    words: input.where === 'folder' ? 'Saved in your game folder' : 'Saved on this device',
  }
}
