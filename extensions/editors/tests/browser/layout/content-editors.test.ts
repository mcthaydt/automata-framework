import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { SIZES } from '@automata/editor/kit/testing'
import { fixtureEditor } from '@automata/editor/suite/testing'
import {
  inShell,
  noPageScroll,
  type OpenedSuite,
  openSuite,
  tab,
} from '@automata/editor/suite/testing/layout'
import { checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { contentEditors } from '#src/app/suite/content-editors.ts'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'

// The four content editors in the suite's one shell with the production CSS in a real browser, at the two sizes the Owner
// holds them to: a phone (390 x 844) and an iPad (820 x 1180). Each opens on the sample game's file, nothing covers it,
// every control a finger can press is 44 px (a primary 48), and the page never scrolls (only the editor's own regions do).

const phone = SIZES.find((size) => size.name === 'phone-portrait')
if (phone === undefined) throw new Error('the kit has no phone size')
const ipad = { ...phone, name: 'ipad-air-portrait', width: 820, height: 1180, mode: 'medium' as const }
const sizes = [phone, ipad]

/** What each editor shows once its file is open, to wait for. */
const READY: Readonly<Record<string, string>> = {
  Feel: 'section[aria-label="Feel"]',
  Audio: '[aria-label="Sounds and music"], [aria-label="Audio"]',
  Writer: 'textarea',
  Sequence: '[aria-label="Playing"]',
}

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

/** Every control in the shell's page that is on screen. */
const controls = (): HTMLElement[] =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '[data-editor-shell] main :is(button, input, select, textarea)',
    ),
  ].filter((element) => element.getClientRects().length > 0)

describe.each(sizes)('Content editors at $name ($width x $height)', (size) => {
  test.each(Object.keys(READY))(
    '%s fits: its controls are touch size and the page never scrolls',
    async (name) => {
      opened = await openSuite(
        size,
        [fixtureEditor as SuiteEditor<unknown>, ...contentEditors()],
        CONTENT_SAMPLE_GAME,
        READY[name] as string,
        name,
      )
      const main = inShell('main')
      const box = main.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(size.width / 3)
      expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
      expect(checkLayout(opened.conditions, [tab(name), ...controls()])).toEqual([])
      noPageScroll()
      await page.screenshot({ path: `.vitest/shots/content-${name.toLowerCase()}-${size.name}.png` })
    },
  )
})
