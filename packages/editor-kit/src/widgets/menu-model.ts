// Type-ahead for menus (kit spec §4.6, the WAI-ARIA menu pattern): letters typed close together make a word and jump to
// the next item that starts with it; the same letter pressed again cycles through the items that start with it.
// Pure; the caller supplies the time.

export interface TypeaheadState {
  readonly text: string
  readonly at: number
}

/** Adds a typed character to the word, or starts a new word when the last key was more than `windowMs` ago. */
export function advanceTypeahead(
  state: TypeaheadState | undefined,
  key: string,
  now: number,
  windowMs = 700,
): TypeaheadState {
  const continues = state !== undefined && now - state.at <= windowMs
  return { text: (continues ? state.text : '') + key.toLowerCase(), at: now }
}

/**
 * The index of the item to move to, or `undefined`. `from` is the item that has focus. A word starts matching at
 * `from` itself, so a word still being typed stays put; a single repeated letter starts after `from`.
 */
export function findTypeahead(
  labels: readonly string[],
  text: string,
  from: number,
  isEnabled: (index: number) => boolean,
): number | undefined {
  const typed = text.toLowerCase()
  if (typed === '' || labels.length === 0) return undefined
  const repeated = typed.length > 1 && [...typed].every((character) => character === typed[0])
  const needle = repeated ? (typed[0] ?? '') : typed
  const first = typed.length === 1 || repeated ? from + 1 : from
  for (let step = 0; step < labels.length; step++) {
    const index = (((first + step) % labels.length) + labels.length) % labels.length
    if (isEnabled(index) && (labels[index] ?? '').toLowerCase().startsWith(needle)) return index
  }
  return undefined
}
