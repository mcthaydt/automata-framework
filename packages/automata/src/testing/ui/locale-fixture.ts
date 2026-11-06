/**
 * The languages ui's layout contracts run every fixture in: the fixtures' English
 * stand-ins as written, and their `xx-long` form, about 40% longer, accented and bracketed, from the pseudo-locale
 * content owns. A fixture takes a `locale` prop and says each of its words with `say`.
 *
 * Test-only: it imports `@mcthaydt/automata-content`, which is ui's dev dependency, so the published build strips
 * it with the fixtures (`*-fixture` in tooling/release's `finishSvelteDist`).
 */

import { hasRawText, PSEUDO_LOCALE, pseudoLocalize } from '@mcthaydt/automata-content/locale'

/** `en`, the English stand-ins as written, or the pseudo-locale's tag. */
export type FixtureLocale = 'en' | typeof PSEUDO_LOCALE
export const FIXTURE_LOCALES: readonly FixtureLocale[] = ['en', PSEUDO_LOCALE]

/** A fixture's word in `locale`: the English stand-in as written, or its xx-long form. */
export function say(locale: FixtureLocale, text: string): string {
  return locale === PSEUDO_LOCALE ? pseudoLocalize(text) : text
}

/** A key or a pad button, labelled as the device prints it: the same in every language. */
const PRINTED_ON_DEVICE = '[data-prompt="key"], [data-prompt="pad"]'

/**
 * The text under `root` that is not in xx-long: a word a fixture or a primitive shows without going through the
 * locale, which the xx-long run would otherwise measure in English. Two kinds of text are not the page's words:
 * text in an element in its own language (a `lang` other than the page's: the language picker names each language
 * in that language), and a key's or pad button's label as the device prints it.
 */
export function findUntranslated(root: Element): string[] {
  const page = root.ownerDocument.documentElement
  const problems: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (!hasRawText(text)) continue
    const owner = node.parentElement
    const language = owner?.closest('[lang]')
    if (language !== null && language !== undefined && language !== page) continue
    if (owner?.closest(PRINTED_ON_DEVICE)) continue
    problems.push(`"${text.trim()}" is not in xx-long`)
  }
  return problems
}
