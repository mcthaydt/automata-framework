import '@automataframework/framework/theme.css'
import {
  byTestId,
  checkLayout,
  mountFixture,
  publishConditions,
  REFERENCE_SIZES,
  settleLayout,
  VARIANTS,
} from '@automataframework/framework/testing'
import { describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import StaleBuild from '#src/features/stale/StaleBuild.svelte'

// The stale-build panel at every reference size and variant: it fits, Reload is whole, hit-testable, 48 px and focused.
const COPY = { message: 'This game was updated. Reload to get the new version.', reload: 'Reload' }
const LONG = { message: `${COPY.message} ${COPY.message}`, reload: 'Reload the page now' }

for (const [name, copy] of [
  ['en', COPY],
  ['long words', LONG],
] as const) {
  describe(`stale build layout contract (${name})`, () => {
    test.each([...REFERENCE_SIZES])('$name ($width x $height)', async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(StaleBuild, { copy, onReload: () => {} })
        await vi.waitFor(() => expect(byTestId('stale-build')).toBeTruthy())
        await settleLayout()
        const reload = byTestId('stale-build').querySelector('button')
        if (reload === null) problems.push(`${variant.name}: no Reload button`)
        else {
          if (variant.keyboard === undefined) {
            for (const problem of checkLayout(conditions, [reload]))
              problems.push(`${variant.name}: ${problem}`)
          }
          const scale =
            Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--af-scale')) || 1
          if (reload.getBoundingClientRect().height < 48 * scale - 0.5)
            problems.push(`${variant.name}: Reload is under 48 px`)
          if (document.activeElement !== reload) problems.push(`${variant.name}: Reload is not focused`)
        }
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  })
}
