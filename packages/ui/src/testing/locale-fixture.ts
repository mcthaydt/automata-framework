/**
 * The languages ui's layout contracts run every fixture in (PRODUCT spec §4 item 7): the fixtures' English
 * stand-ins as written, and their `xx-long` form, about 40% longer, accented and bracketed, from the pseudo-locale
 * content owns. A fixture takes a `locale` prop and says each of its words with `say`.
 *
 * Test-only: it imports `@mcthaydt/automata-content`, which is ui's dev dependency, so the published build strips
 * it with the fixtures (`*-fixture` in tooling/release's `finishSvelteDist`).
 */

import { hasRawText, PSEUDO_LOCALE, pseudoLocalize } from '@mcthaydt/automata-content/locale'

export const FIXTURE_LOCALES = ['en', PSEUDO_LOCALE] as const
export type FixtureLocale = (typeof FIXTURE_LOCALES)[number]

/** A fixture's word in `locale`: the English stand-in as written, or its xx-long form. */
export function say(locale: FixtureLocale, text: string): string {
  return locale === PSEUDO_LOCALE ? pseudoLocalize(text) : text
}

/**
 * The text under `root` that is not in xx-long: a word a fixture or a primitive shows without going through the
 * locale, which the xx-long run would otherwise measure in English. Text in an element in its own language (a
 * `lang` other than the page's: the language picker names each language in that language) is not the page's.
 */
export function findUntranslated(root: Element): string[] {
  const page = root.ownerDocument.documentElement
  const problems: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (!hasRawText(text)) continue
    const language = node.parentElement?.closest('[lang]')
    if (language !== null && language !== undefined && language !== page) continue
    problems.push(`"${text.trim()}" is not in xx-long`)
  }
  return problems
}
