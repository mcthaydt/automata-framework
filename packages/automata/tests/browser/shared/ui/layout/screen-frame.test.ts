import '#src/shared/ui/theme.css'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'
import { FIXTURE_LOCALES, findUntranslated } from '#src/testing/ui/locale-fixture.ts'
import ScreenFixture from '#src/testing/ui/ScreenFixture.svelte'
import { settleLayout } from '#src/testing/ui/settle.ts'
import { mountFixture } from '#src/testing/fixtures/mount.ts'
import {
  REFERENCE_SIZES,
  type ReferenceSize,
  VARIANTS,
  type Variant,
} from '#src/testing/layout/reference-sizes.ts'

// ScreenFrame, CornerControls, ScrollList and ActionBar together, at every reference size and
// variant, with production CSS (M1.6 spec §7, plan Task 11), in English and again in the xx-long pseudo-locale (PRODUCT
// spec §4 item 7).
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

for (const locale of FIXTURE_LOCALES) {
  describe(`screen layout contract (${locale})`, () => {
    test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const arrangement = conditions.geometry.formFactor.endsWith('portrait') ? 'stack' : 'split'
        const fixture = mountFixture(ScreenFixture, { arrangement, locale })
        await settleLayout()
        // With the keyboard open the frame scrolls what does not fit (spec §3.4), so reaching an
        // action may take a scroll; nothing may sit under the keyboard, which `checkLayout` checks.
        const essentials = variant.keyboard === undefined ? essentialsAt(size, variant).map(byTestId) : []
        const found = [
          ...checkLayout(conditions, essentials),
          ...(locale === 'en' ? [] : findUntranslated(document.body)),
        ]
        for (const problem of found) problems.push(`${variant.name}: ${problem}`)
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  })
}

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

describe('screen frame width', () => {
  // PRODUCT.L3a: in a long language the action bar's unwrapped row is wider than the body. The actions' box took
  // that width, widened the body's column past the screen and so never let the bar give way.
  test('keeps its actions inside the body, so a bar wider than the body gives way rather than widening it', async () => {
    const size = REFERENCE_SIZES.find((candidate) => candidate.name === 'phone-small')
    const tv = VARIANTS.find((variant) => variant.name === 'tv-scale')
    if (size === undefined || tv === undefined) throw new Error('no phone-small or tv-scale variant')
    await page.viewport(size.width, size.height)
    publishConditions(document.documentElement, size, tv)
    const fixture = mountFixture(ScreenFixture, { arrangement: 'stack', locale: 'xx-long' })
    await settleLayout()
    const body = byTestId('screen').querySelector('.af-screen-frame__body')?.getBoundingClientRect()
    const actions = byTestId('screen').querySelector('.af-screen-frame__actions')?.getBoundingClientRect()
    const level = byTestId('actions').dataset.collapse
    await fixture.unmount()
    expect(actions?.right).toBeLessThanOrEqual((body?.right ?? 0) + 0.5)
    expect(level).not.toBe('0')
  })
})
