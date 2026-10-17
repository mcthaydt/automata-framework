// The smoke test every example gets (EX spec §5, §7), parametric over the catalog so adding an example adds no
// test file: it boots under the fake host with the header's `Host:` settings, reaches the semantic ready, and
// logs no console error or CSP violation. A pending example is reported as skipped with its task, never as passed.
import { expect, test } from '@playwright/test'
import { collectErrors, openHosted } from '../host/testing.ts'
import type { CatalogEntry } from './catalog.ts'
import { EXAMPLES_GAME_ID } from './page-template.ts'

/**
 * Defines, under `suite`, the index test and one smoke test per entry; `origin` is where the examples build is
 * served.
 */
export function smokeExamples(suite: string, entries: readonly CatalogEntry[], origin: string): void {
  test.describe(suite, () => defineSmokeTests(entries, origin))
}

function defineSmokeTests(entries: readonly CatalogEntry[], origin: string): void {
  test('the index lists every example under its module and logs no errors', async ({ page }) => {
    const errors = await collectErrors(page)
    await page.goto(`${origin}/`)
    await expect(page.locator('h1')).toHaveText('AF examples')
    await expect(page.locator('[data-example]')).toHaveCount(entries.length)
    for (const entry of entries) {
      const item = page.locator(`section[data-module="${entry.module}"] [data-example="${entry.id}"]`)
      await expect(item, `${entry.id} under ${entry.module}`).toHaveCount(1)
      const pending = entry.header?.pending
      if (pending !== undefined) await expect(item, entry.id).toContainText(`pending: ${pending}`)
    }
    expect(errors).toEqual([])
  })

  for (const entry of entries) {
    test(`${entry.id} boots under the fake host with no errors`, async ({ page }) => {
      const pending = entry.header?.pending
      test.skip(pending !== undefined, `pending: ${pending}`)
      const errors = await collectErrors(page)
      await openHosted(page, `${origin}${entry.url}`, EXAMPLES_GAME_ID, entry.header?.host ?? {})
      expect(errors).toEqual([])
    })
  }
}
