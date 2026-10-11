import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import DialogFixture from '../testing/DialogFixture.svelte'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import { settleLayout } from '../testing/settle'

// Dialog at every reference size and variant, with production CSS (M1.6 spec §7, plan Task 11).
// Its actions stay reachable in every case, the keyboard included: the body scrolls, not the actions.
describe('dialog layout contract', () => {
  test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const problems: string[] = []
    for (const variant of VARIANTS) {
      const conditions = publishConditions(document.documentElement, size, variant)
      const fixture = mountFixture(DialogFixture, {})
      await settleLayout()
      const essentials = [byTestId('dialog-cancel'), byTestId('dialog-confirm')]
      for (const problem of checkLayout(conditions, essentials)) problems.push(`${variant.name}: ${problem}`)
      await fixture.unmount()
    }
    expect(problems).toEqual([])
  })
})
