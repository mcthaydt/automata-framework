// Words that may change while the game runs, because the player's language can: Settings changes it with a screen up.

/** Words read now, and a way to hear that they changed. `subscribe` calls the listener on each change, not at once. */
export interface LiveWords<T> {
  readonly current: T
  subscribe(listener: () => void): () => void
}

/** Whether `words` is live (a reader that changes) rather than a fixed record. */
export function isLiveWords<T extends object>(words: T | LiveWords<T>): words is LiveWords<T> {
  return 'subscribe' in words && 'current' in words
}

/** The words as they are now: a fixed record as it is, a live one as it reads. */
export function wordsNow<T extends object>(words: T | LiveWords<T> | undefined): T | undefined {
  return words === undefined ? undefined : isLiveWords(words) ? words.current : words
}
