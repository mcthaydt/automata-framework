import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import type { SuiteEnv } from '#src/features/suite/shell/boot.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { type EditorSize, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import { editorList, noPageScroll, type OpenedSuite, openSuite } from '#src/testing/suite/suite-layout.ts'

// The saved line says whether the work is safe, so on a phone it must be whole: it used to be cut to "Saved on this
// de…", and the longest words, the browser that keeps nothing, pushed Redo off the screen. Every line the page can say
// is whole on every phone, with the game's name and Undo and Redo still in view.

const FILES = {
  'content/editors.toml': editorList('content/tuning.toml', 'tuner'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
}

const PHONES: readonly EditorSize[] = [
  ...SIZES.filter((size) => size.name === 'phone-portrait' || size.name === 'phone-landscape'),
  {
    ...(SIZES.find((size) => size.name === 'phone-portrait') as EditorSize),
    name: 'small-phone',
    width: 360,
    height: 740,
  },
  { ...(SIZES.find((size) => size.name === 'ipad-pro-11-portrait') as EditorSize) },
]

/** The three places a game's files can be, each with its own words. */
const WHERE: readonly (readonly [string, Pick<SuiteEnv, 'sample' | 'kept' | 'game'>])[] = [
  ['in a game folder', { game: 'Lantern Run' }],
  ['kept on this device', { sample: true, kept: true, game: 'Lantern Run' }],
  ['in a browser that keeps nothing', { sample: true, kept: false, game: 'Lantern Run' }],
]

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

const whole = (element: HTMLElement | null, name: string): void => {
  if (element === null) throw new Error(`no ${name}`)
  const box = element.getBoundingClientRect()
  expect(box.width, `${name} has a width`).toBeGreaterThan(0)
  expect(box.left, `${name} is on the left of the screen`).toBeGreaterThanOrEqual(-0.5)
  expect(box.right, `${name} is on the right of the screen`).toBeLessThanOrEqual(window.innerWidth + 0.5)
  expect(box.bottom, `${name} is above the foot of the screen`).toBeLessThanOrEqual(window.innerHeight + 0.5)
}

describe.each(PHONES)('the saved line at $name ($width x $height)', (size) => {
  test.each(WHERE)('says all of it %s, with the game name and Undo and Redo in view', async (where, game) => {
    opened = await openSuite(
      size,
      [fixtureEditor as SuiteEditor<unknown>],
      FILES,
      '[data-testid]',
      'Tuner',
      game,
    )
    await settleLayout()
    const words = document.querySelector<HTMLElement>('[role="status"] .words')
    if (words === null) throw new Error('no saved line')
    // On a phone held upright every line has a row of its own and shows whole. On a wider bar the longest line (a browser
    // that keeps nothing) may shorten with an ellipsis rather than push Redo or the Dock off the screen; it then still
    // opens with "Not saved" and the whole words are the status's title.
    const shortens = where === 'in a browser that keeps nothing' && size.width >= 600
    if (shortens) {
      expect(words.textContent, 'the shortened line still says it is not saved').toMatch(/^Not saved/)
      expect(words.parentElement?.getAttribute('title'), 'the whole words are kept as the title').toBe(
        words.textContent,
      )
    } else {
      expect(words.scrollWidth, `"${words.textContent}" is not cut`).toBeLessThanOrEqual(
        words.clientWidth + 1,
      )
    }
    whole(words, 'the saved line')
    const brand = document.querySelector<HTMLElement>('.brand')
    // The name and the line share what the tools leave; when the line shortens, so may the name (it ends in an ellipsis).
    if (!shortens)
      expect(brand?.scrollWidth, 'the game name is not cut').toBeLessThanOrEqual(
        (brand?.clientWidth ?? 0) + 1,
      )
    else whole(brand, 'the game name')
    for (const label of ['Undo', 'Redo']) {
      const control = [...document.querySelectorAll<HTMLElement>('button')].find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith(label),
      )
      whole(control ?? null, label)
    }
    noPageScroll()
  })
})
