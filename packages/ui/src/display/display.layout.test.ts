import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import DisplayFixture, { DISPLAY_SHOWS, type DisplayShow } from '../testing/DisplayFixture.svelte'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import { settleLayout } from '../testing/settle'

// The display covers (M4 spec §4.9, §7) at every reference size and variant, with production CSS, in Chromium,
// WebKit and Firefox. The gate's one button is a whole primary target a player can reach; the covers' words stay on
// screen, clear of the keyboard and Ruken's strip.

/** The cover's panel, whole on screen. */
function coverProblems(show: DisplayShow): string[] {
  const panel = byTestId(show === 'rotate' ? 'rotate-hint' : 'landscape-gate').querySelector<HTMLElement>(
    show === 'rotate' ? 'p' : '[role="dialog"]',
  )
  const box = panel?.getBoundingClientRect()
  if (box === undefined) return ['the cover has no panel']
  return box.left < -0.5 || box.top < -0.5 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5
    ? ['the cover’s panel is not whole on screen']
    : []
}

describe('display covers layout contract', () => {
  for (const show of DISPLAY_SHOWS) {
    test.each(REFERENCE_SIZES)(`${show} at $name ($width x $height)`, async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(DisplayFixture, { show })
        await settleLayout()
        // With the keyboard up the gate's panel scrolls (a declared region), as every screen does.
        const essentials =
          show === 'gate-fullscreen' && variant.keyboard === undefined
            ? [byTestId('landscape-gate-fullscreen')]
            : []
        const found = [...checkLayout(conditions, essentials), ...coverProblems(show)]
        for (const problem of found) problems.push(`${variant.name}: ${problem}`)
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  }
})
