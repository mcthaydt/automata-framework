import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import SettingsFixture, { SETTINGS_SHOWS, type SettingsShow } from '../testing/SettingsFixture.svelte'
import { settleLayout } from '../testing/settle'

// The core Settings screen (M4 spec §4.8, §7, §8) at every reference size and variant, keyboard, Ruken's strip and
// TV scale included, with production CSS, in Chromium, WebKit and Firefox. Every rebind button and option is a whole
// target; the sections scroll inside their list, so Back and the first row stay reachable on a short screen.

/**
 * What a player must reach without scrolling: Back, and the first row's rebind buttons; while a capture waits, the
 * button that waits (the section keeps it in view), as the row's other buttons may wrap below it on a short screen.
 */
function essentials(show: SettingsShow, keyboard: boolean): HTMLElement[] {
  // With the keyboard up the frame scrolls what does not fit (screen-frame.layout.test.ts holds that).
  if (keyboard) return []
  const first =
    show === 'settings-capturing'
      ? [...document.querySelectorAll<HTMLElement>('[data-control-row="left"] [data-capturing]')]
      : [...document.querySelectorAll<HTMLElement>('[data-control-row="left"] [data-rebind]')]
  return [byTestId('corner-back'), ...first]
}

describe('Settings screen layout contract', () => {
  for (const show of SETTINGS_SHOWS) {
    test.each(REFERENCE_SIZES)(`${show} at $name ($width x $height)`, async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(SettingsFixture, { show })
        await settleLayout()
        for (const problem of checkLayout(conditions, essentials(show, variant.keyboard !== undefined)))
          problems.push(`${variant.name}: ${problem}`)
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  }
})
