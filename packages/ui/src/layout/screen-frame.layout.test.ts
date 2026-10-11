import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import ScreenFixture from '../testing/ScreenFixture.svelte'
import { settleLayout } from '../testing/settle'

// ScreenFrame, CornerControls, ScrollList and ActionBar together, at every reference size and
// variant, with production CSS (M1.6 spec §7, plan Task 11).
const ESSENTIALS = ['corner-back', 'mute', 'play', 'settings', 'help', 'row-Forest', 'row-Cave']

describe('screen layout contract', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of VARIANTS) {
      const conditions = publishConditions(document.documentElement, size, variant)
      const arrangement = conditions.geometry.formFactor.endsWith('portrait') ? 'stack' : 'split'
      const fixture = mountFixture(ScreenFixture, { arrangement })
      await settleLayout()
      // With the keyboard open the frame scrolls what does not fit (spec §3.4), so reaching an
      // action may take a scroll; nothing may sit under the keyboard, which `checkLayout` checks.
      const essentials = variant.keyboard === undefined ? ESSENTIALS.map(byTestId) : []
      for (const problem of checkLayout(conditions, essentials)) problems.push(`${variant.name}: ${problem}`)
      await fixture.unmount()
    }
    expect(problems).toEqual([])
  })
})
