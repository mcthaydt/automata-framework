// What a content editor says when the game's list of editors leaves it out. The list is the game's own file, so the
// words name the editor and say what to press, not which row is missing.

/** The editors a game's list can leave out, by the name a person sees on the rail. */
export const EDITOR_NAMES: Readonly<Record<string, string>> = {
  tuner: 'Tuner',
  feel: 'Feel',
  audio: 'Audio',
  writer: 'Writer',
  sequence: 'Sequence',
  schematic: 'Schematic',
}

/** A write refused because no row of the list names the file (the write path's, the memory workspace's, the server's). */
const UNLISTED = /no row of .* (?:lists|names) it/

export const isUnlisted = (message: string): boolean => UNLISTED.test(message)

/**
 * The refusal in words, or `message` as it came when it is not about the list. On a start page there is no file yet, so
 * Start is the way out; on an open file the row went away under it, and only the person can put it back.
 */
export function listedWords(editor: string | undefined, message: string, starting: boolean): string {
  if (editor === undefined || !isUnlisted(message)) return message
  const name = EDITOR_NAMES[editor] ?? editor
  return starting
    ? `This game's list of editors doesn't include ${name} yet. Press Start to add it.`
    : `${name} can't save: this game's list of editors leaves ${name} out.`
}
