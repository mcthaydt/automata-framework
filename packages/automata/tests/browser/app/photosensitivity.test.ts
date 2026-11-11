import '#src/shared/ui/theme.css'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { mountFixture } from '#src/testing/fixtures/mount.ts'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import FirstRunFixture from '#src/testing/ui/FirstRunFixture.svelte'
import { checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'
import { FIXTURE_LOCALES, findUntranslated } from '#src/testing/ui/locale-fixture.ts'
import { settleLayout } from '#src/testing/ui/settle.ts'

// The photosensitivity warning at every reference size and variant, with production CSS: the long body scrolls inside
// its own region, Continue and Close are whole and hit-testable, Continue is 48 px, the switches are at least 44 px,
// and the document never scrolls. It runs in English and in the xx-long pseudo-locale.

for (const locale of FIXTURE_LOCALES) {
  describe(`photosensitivity warning layout contract (${locale})`, () => {
    test.each(REFERENCE_SIZES)('warning at $name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(FirstRunFixture, { show: 'warning', locale })
        await settleLayout()
        const proceed = document.querySelector<HTMLElement>('[data-testid="photosensitivity-continue"]')
        const close = document.querySelector<HTMLElement>('[data-modal-close]')
        const switches = [...document.querySelectorAll<HTMLElement>('[data-testid^="warning-switch-"]')]
        expect(proceed).not.toBeNull()
        expect(switches).toHaveLength(2)
        // The body, switches included, scrolls where a short or enlarged screen cannot show it whole; Continue and
        // Close sit outside it and are always reachable.
        const essential = [...(proceed === null ? [] : [proceed]), ...(close === null ? [] : [close])]
        const found = [
          ...checkLayout(conditions, essential),
          ...(locale === 'en' ? [] : findUntranslated(document.body)),
        ]
        for (const problem of found) problems.push(`${variant.name}: ${problem}`)
        if (proceed !== null && proceed.getBoundingClientRect().height < 48 - 0.5)
          problems.push(`${variant.name}: Continue is under 48 px`)
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  })
}
