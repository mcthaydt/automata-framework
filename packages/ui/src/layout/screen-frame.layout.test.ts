import '../theme.css'
import {
  mountFixture,
  REFERENCE_SIZES,
  type ReferenceSize,
  VARIANTS,
  type Variant,
} from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import ScreenFixture from '../testing/ScreenFixture.svelte'
import { settleLayout } from '../testing/settle'

// ScreenFrame, CornerControls, ScrollList and ActionBar together, at every reference size and
// variant, with production CSS (M1.6 spec §7, plan Task 11).
const ESSENTIALS = ['corner-back', 'mute', 'play', 'settings', 'help', 'row-Forest', 'row-Cave']

/**
 * At TV scale every target is 1.333x, and a compact screen (under 340 px tall) cannot hold the
 * corner row, two whole rows and the action bar: at 780x270 that is 8 + 60 + 8 + (60 + 8 + 60) +
 * 8 + 64 + 8 = 284 px. The list then keeps one whole row and scrolls the rest, inside its own box
 * (it never paints over the action bar), so the second row is not an essential there.
 */
function essentialsAt(size: ReferenceSize, variant: Variant): readonly string[] {
  const cramped = variant.scale !== undefined && variant.scale > 1 && size.heightTier === 'compact'
  return cramped ? ESSENTIALS.filter((id) => id !== 'row-Cave') : ESSENTIALS
}

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
      const essentials = variant.keyboard === undefined ? essentialsAt(size, variant).map(byTestId) : []
      for (const problem of checkLayout(conditions, essentials)) problems.push(`${variant.name}: ${problem}`)
      await fixture.unmount()
    }
    expect(problems).toEqual([])
  })
})

describe('screen frame padding', () => {
  test('with the keyboard up the foot pads by the gutter alone: the safe area is under the keyboard', async () => {
    const size = REFERENCE_SIZES.find((candidate) => candidate.name === 'iphone-14')
    const keyboard = VARIANTS.find((variant) => variant.name === 'keyboard')
    if (size === undefined || keyboard === undefined) throw new Error('no iphone-14 or keyboard variant')
    await page.viewport(size.width, size.height)
    const root = document.documentElement
    publishConditions(root, size, keyboard)
    root.style.setProperty('--af-inset-bottom', '34px')
    const fixture = mountFixture(ScreenFixture, { arrangement: 'stack' })
    await settleLayout()
    const frame = byTestId('screen')
    expect(getComputedStyle(frame).paddingBottom).toBe(
      getComputedStyle(root).getPropertyValue('--af-gutter').trim(),
    )
    await fixture.unmount()
    root.style.removeProperty('--af-inset-bottom')
  })
})
