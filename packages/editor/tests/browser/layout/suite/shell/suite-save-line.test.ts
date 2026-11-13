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

// The saved line says whether the work is safe, so it must be whole: it used to be cut to "Saved on this de…", and the
// longest words, the browser that keeps nothing, pushed Redo off the screen, then were cut to "Not saved: this bro…" on
// any bar wider than a phone held upright, with the rest in a title a finger cannot read. Every line the page can say is
// whole at every size here, phones and iPads, with the game's name and Undo and Redo still in view.

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
  ...SIZES.filter(
    (size) =>
      size.name === 'ipad-pro-11-portrait' ||
      size.name === 'ipad-pro-11-landscape' ||
      size.name === 'ipad-mini-portrait',
  ),
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
    expect(words.scrollWidth, `"${words.textContent}" is not cut`).toBeLessThanOrEqual(words.clientWidth + 1)
    expect(words.scrollHeight, `"${words.textContent}" is not clipped below`).toBeLessThanOrEqual(
      words.clientHeight + 1,
    )
    if (where === 'in a browser that keeps nothing')
      expect(words.textContent, 'the whole warning is on screen').toBe(
        'Not saved: this browser can’t keep your work. It is lost when this page closes.',
      )
    whole(words, 'the saved line')
    const brand = document.querySelector<HTMLElement>('.brand')
    expect(brand?.scrollWidth, 'the game name is not cut').toBeLessThanOrEqual((brand?.clientWidth ?? 0) + 1)
    for (const label of ['Undo', 'Redo']) {
      const control = [...document.querySelectorAll<HTMLElement>('button')].find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith(label),
      )
      whole(control ?? null, label)
    }
    noPageScroll()
  })
})
