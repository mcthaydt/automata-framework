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
  /** Why the browser keeps nothing, when it said. */
  readonly reason?: string | undefined
  /** What the sync loop says about GitHub, once the game is kept there. */
  readonly sync?: { readonly line: string } | undefined
}

export interface SaveLine {
  readonly state: 'saved' | 'saving' | 'failed'
  readonly words: string
}

const NOWHERE = 'Not saved: this browser can’t keep files. Save a copy to keep your work.'

export function saveLine(input: SaveLineInput): SaveLine {
  // A browser that keeps nothing never says Saved, whatever is typed: the work is in memory only.
  if (input.where === 'nowhere') return { state: 'failed', words: NOWHERE }
  if (input.failed !== undefined) return { state: 'failed', words: `Not saved: ${input.failed}` }
  if (input.pending > 0) return { state: 'saving', words: 'Saving…' }
  if (input.sync !== undefined) return { state: 'saved', words: input.sync.line }
  return {
    state: 'saved',
    words: input.where === 'folder' ? 'Saved in your game folder' : 'Saved on this device',
  }
}
