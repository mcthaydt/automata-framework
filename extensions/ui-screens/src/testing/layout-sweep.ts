// The layout contract every kit screen runs (M1.6 spec §7), with production CSS in a real browser: at every reference size and
// variant, in English and in the `xx-long` pseudo-locale (about 40% longer, accented and bracketed, so a word that skipped the
// copy shows up): no document scroll, whole 44 px targets (48 px primaries), nothing off screen or under the host's strip, and
// every essential action visible and hit-testable. The checks are core's (`checkLayout`); this only sweeps them.
import { hasRawText, PSEUDO_LOCALE, pseudoLocalize } from '@automata/content/locale'
import {
  byTestId,
  checkLayout,
  type MountedFixture,
  publishConditions,
  REFERENCE_SIZES,
  type ReferenceSize,
  settleLayout,
  VARIANTS,
  type Variant,
} from '@automata/framework/testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'

export type Locale = 'en' | typeof PSEUDO_LOCALE
export const LOCALES: readonly Locale[] = ['en', PSEUDO_LOCALE]

/** A word the game or the host supplies (a title, a player's name), as it reads in `locale`. */
export const say = (locale: Locale, text: string): string =>
  locale === PSEUDO_LOCALE ? pseudoLocalize(text) : text

/** `value` with every word, and every word a function makes, in the pseudo-locale. Ids and numbers are left alone by the caller. */
export function pseudo<T>(value: T): T {
  if (typeof value === 'string') return pseudoLocalize(value) as T
  if (typeof value === 'function')
    return ((...args: unknown[]) => pseudoLocalize((value as (...a: unknown[]) => string)(...args))) as T
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, part]) => [key, pseudo(part)])) as T
  return value
}

/** The page's text that is not in the pseudo-locale: a word some screen shows without going through its copy. */
export function untranslated(root: Element): string[] {
  const problems: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    // An icon hidden from assistive technology is a picture, not a word.
    if (!hasRawText(text) || node.parentElement?.closest('[aria-hidden="true"]')) continue
    problems.push(`"${text.trim()}" is not in ${PSEUDO_LOCALE}`)
  }
  for (const element of root.querySelectorAll('[aria-label]')) {
    const label = element.getAttribute('aria-label') ?? ''
    if (hasRawText(label)) problems.push(`aria-label "${label}" is not in ${PSEUDO_LOCALE}`)
  }
  return problems
}

/**
 * Registers the contract for one screen. `mount` puts the screen on the page in `locale`; `essentials` are the test ids a player
 * must always be able to see and hit (they are not asserted while the keyboard is open, when the frame scrolls what does not fit).
 */
export function layoutContract(
  name: string,
  mount: (locale: Locale) => MountedFixture,
  essentials: readonly string[],
): void {
  describe(`${name} layout contract`, () => {
    describe.each(LOCALES)('in %s', (locale) => {
      test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size: ReferenceSize) => {
        await page.viewport(size.width, size.height)
        const problems: string[] = []
        for (const variant of VARIANTS as readonly Variant[]) {
          const conditions = publishConditions(document.documentElement, size, variant)
          const fixture = mount(locale)
          await settleLayout()
          const seen = variant.keyboard === undefined ? essentials.map(byTestId) : []
          for (const problem of checkLayout(conditions, seen)) problems.push(`${variant.name}: ${problem}`)
          if (locale === PSEUDO_LOCALE)
            for (const problem of untranslated(document.body)) problems.push(`${variant.name}: ${problem}`)
          await fixture.unmount()
        }
        expect([...new Set(problems)]).toEqual([])
      })
    })
  })
}
