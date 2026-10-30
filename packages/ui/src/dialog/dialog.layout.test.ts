import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import DialogFixture from '../testing/DialogFixture.svelte'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import { FIXTURE_LOCALES, findUntranslated } from '../testing/locale-fixture'
import { settleLayout } from '../testing/settle'

// Dialog at every reference size and variant, with production CSS (M1.6 spec §7, plan Task 11).
// Its actions stay reachable in every case, the keyboard included: the body scrolls, not the actions. The contract
// runs in English and again in the xx-long pseudo-locale (PRODUCT spec §4 item 7).
for (const locale of FIXTURE_LOCALES) {
  describe(`dialog layout contract (${locale})`, () => {
    test.each(REFERENCE_SIZES)('$name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(DialogFixture, { locale })
        await settleLayout()
        const essentials = [byTestId('dialog-cancel'), byTestId('dialog-confirm')]
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
