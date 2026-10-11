import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import StatusFixture from '../testing/StatusFixture.svelte'
import { settleLayout } from '../testing/settle'

// LoaderOverlay, the boot failure panel and an ErrorPanel at every reference size and variant,
// keyboard included, with production CSS (M1.6 spec §7, plan Task 11). A failure can arrive while
// the player is typing, so its actions must stay clear of the keyboard.
const ESSENTIALS = {
  loader: ['loader-overlay'],
  'boot-failure': ['error-continue'],
  error: ['error-retry', 'error-dismiss'],
} as const

describe('status layout contract', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of VARIANTS) {
      for (const show of ['loader', 'boot-failure', 'error'] as const) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(StatusFixture, { show })
        await settleLayout()
        for (const problem of checkLayout(conditions, ESSENTIALS[show].map(byTestId)))
          problems.push(`${variant.name} ${show}: ${problem}`)
        await fixture.unmount()
      }
    }
    expect(problems).toEqual([])
  })
})
