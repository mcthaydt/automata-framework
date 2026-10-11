import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import StatusFixture from '../testing/StatusFixture.svelte'
import { settleLayout } from '../testing/settle'

// LoaderOverlay and the boot failure panel at every reference size, with production CSS (M1.6 spec
// §7, plan Task 11). Both are boot screens: no text field exists yet, so no keyboard can be open,
// and the keyboard variant is left out.
const BOOT_VARIANTS = VARIANTS.filter((variant) => variant.keyboard === undefined)

describe('status layout contract', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of BOOT_VARIANTS) {
      for (const show of ['loader', 'error'] as const) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(StatusFixture, { show })
        await settleLayout()
        const essentials = show === 'loader' ? [byTestId('loader-overlay')] : [byTestId('error-continue')]
        for (const problem of checkLayout(conditions, essentials))
          problems.push(`${variant.name} ${show}: ${problem}`)
        await fixture.unmount()
      }
    }
    expect(problems).toEqual([])
  })
})
