// Keeps the words of a plain-DOM panel in the player's language.
// A game that draws its own screens without a UI framework names a word on an element (`data-word="play"`, or
// `data-word-label="pause"` for an element whose name is not its text) and hands over a catalog function; the runtime
// fills them now and again on each language change, with the screen and its focus left where they are (L-c).

import type { Locale } from './locale.manager.ts'

/**
 * Puts the words for the language in force into every `[data-word]` (as its text) and `[data-word-label]` (as its
 * `aria-label`) element under `root`, now and each time the language changes. `wordsFor` gives a locale's words by name;
 * a name whose word is not text (a function that fills a number in) or is not there leaves its element alone. `after`
 * is told each time, with the words and the locale, for what the panel works out itself. Returns what stops it: add it
 * to the screen's disposables.
 */
export function bindWords<W extends object>(
  root: HTMLElement,
  locale: Pick<Locale, 'subscribe'>,
  wordsFor: (locale: string) => W,
  after: (words: W, locale: string) => void = () => {},
): () => void {
  const text = (words: W, name: string | undefined): string | undefined => {
    const word = (words as Record<string, unknown>)[name ?? '']
    return typeof word === 'string' ? word : undefined
  }
  return locale.subscribe((current) => {
    const words = wordsFor(current)
    for (const element of root.querySelectorAll<HTMLElement>('[data-word]'))
      element.textContent = text(words, element.dataset.word) ?? element.textContent
    for (const element of root.querySelectorAll<HTMLElement>('[data-word-label]')) {
      const label = text(words, element.dataset.wordLabel)
      if (label !== undefined) element.setAttribute('aria-label', label)
    }
    after(words, current)
  })
}
