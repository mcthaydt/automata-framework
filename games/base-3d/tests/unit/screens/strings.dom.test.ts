// @vitest-environment jsdom
// G3-t's DOM half (GAME-3D.1a part 2, DESIGN.md §12.3): every word base-3d's own screens show comes from the live
// copy (copy.svelte.ts), the one seam the catalog feeds, so a language change reaches them all. Each word of a marked
// copy is wrapped in « », and each screen is then searched for any text or accessible name outside the marks.
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { liveCopy } from '#src/features/screens/copy.svelte.ts'
import { BASE3D_COPY, type Base3dCopy } from '#src/features/screens/copy.ts'
import EndScreen from '#src/features/screens/EndScreen.svelte'
import SplashScreen from '#src/features/screens/SplashScreen.svelte'

/** `copy` with every word, and every word a function makes, wrapped in « ». */
function marked<T>(copy: T): T {
  if (typeof copy === 'string') return `«${copy}»` as T
  if (typeof copy === 'function')
    return ((...inputs: unknown[]) => `«${(copy as (...a: unknown[]) => string)(...inputs)}»`) as T
  if (copy !== null && typeof copy === 'object')
    return Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, marked(value)])) as T
  return copy
}

/** Every text and accessible name in `root` that a mark does not wrap (digits and punctuation alone pass). */
function rawWords(root: HTMLElement): string[] {
  const texts: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
    texts.push(node.textContent ?? '')
  for (const element of root.querySelectorAll('[aria-label], [title], [placeholder]'))
    for (const name of ['aria-label', 'title', 'placeholder']) texts.push(element.getAttribute(name) ?? '')
  return texts
    .flatMap((text) => text.split(/«[^»]*»/))
    .map((text) => text.trim())
    .filter((text) => /[A-Za-z]/.test(text))
}

describe('base-3d’s screens’ words (G3-t)', () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    liveCopy.current = BASE3D_COPY.en
    document.body.replaceChildren()
  })
  const screens = [
    ['the splash', () => mount(SplashScreen, { target: document.body, props: { title: '«Ember Hall»' } })],
    ['the end', () => mount(EndScreen, { target: document.body, props: { time: '1:02', onMenu: () => {} } })],
  ] as const

  for (const [name, show] of screens)
    it(`shows only the copy’s words on ${name}`, () => {
      liveCopy.current = marked<Base3dCopy>(BASE3D_COPY.en)
      shown = show()
      flushSync()
      expect(document.body.textContent).toContain('«')
      expect(rawWords(document.body)).toEqual([])
    })
})
