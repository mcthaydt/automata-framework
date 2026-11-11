import '#src/shared/ui/theme.css'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { mountFixture } from '#src/testing/fixtures/mount.ts'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import FirstRunFixture from '#src/testing/ui/FirstRunFixture.svelte'
import { checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'
import { FIXTURE_LOCALES, findUntranslated } from '#src/testing/ui/locale-fixture.ts'
import { settleLayout } from '#src/testing/ui/settle.ts'

// The first run's language screen at every reference size and variant, with production CSS: every language button is
// whole, at least 48 px high and hit-testable, Close is reachable, and the document never scrolls. It runs in English
// and in the xx-long pseudo-locale.

for (const locale of FIXTURE_LOCALES) {
  describe(`first-run language screen layout contract (${locale})`, () => {
    test.each(REFERENCE_SIZES)('language at $name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(FirstRunFixture, { show: 'language', locale })
        await settleLayout()
        const buttons = [...document.querySelectorAll<HTMLElement>('[data-testid^="first-language-"]')]
        const close = document.querySelector<HTMLElement>('[data-modal-close]')
        // With the keyboard up the dialog scrolls what does not fit; only Close is always reachable.
        const essential =
          variant.keyboard === undefined
            ? [...buttons, ...(close === null ? [] : [close])]
            : close === null
              ? []
              : [close]
        const found = [
          ...checkLayout(conditions, essential),
          ...(locale === 'en' ? [] : findUntranslated(document.body)),
        ]
        for (const problem of found) problems.push(`${variant.name}: ${problem}`)
        const tall = buttons.filter((button) => button.getBoundingClientRect().height < 48 - 0.5)
        if (variant.keyboard === undefined && tall.length > 0)
          problems.push(`${variant.name}: a language button is under 48 px`)
        expect(buttons).toHaveLength(6)
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  })
}
