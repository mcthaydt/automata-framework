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

/**
 * A write refused because no row of the list names the file: in the write path's, the memory workspace's and the
 * ports' words, or in the server's, which re-reads the list and so says it of a file the page still thinks is listed.
 */
const UNLISTED = /no row of .* (?:lists|names) it|is not one the editor may (?:read|write)/

export const isUnlisted = (message: string): boolean => UNLISTED.test(message)

/**
 * The refusal in words, or `message` as it came when it is not about the list. Making the file asks the ports to add the
 * editor to the list first, so a refusal that still names the list means they cannot (pressing Start again changes
 * nothing); on an open file the row went away under it, and only the person can put it back.
 */
export function listedWords(editor: string | undefined, message: string, starting: boolean): string {
  if (editor === undefined || !isUnlisted(message)) return message
  const name = EDITOR_NAMES[editor] ?? editor
  return starting
    ? `${name} can't start here. This game's list of editors doesn't include ${name}, and this page can't add it. Ask whoever made the game to add it.`
    : `${name} can't save: this game's list of editors leaves ${name} out.`
}
