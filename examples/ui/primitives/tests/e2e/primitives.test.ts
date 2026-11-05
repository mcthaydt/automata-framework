import { expect, type Page, test } from '@playwright/test'
import { demoUrl } from './origin.ts'

// The primitives demo from its production build, phone first (ship spec §3.7): each primitive drawn full-window
// by the geometry owner, and the gallery, ready and with no console errors.

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

// The same list as `PRIMITIVES` in main.ts (which mounts the demo when imported, so it is not imported here).
for (const primitive of [
  'screen',
  'dialog',
  'loader',
  'error',
  'split',
  'options',
  'pager',
  'paged-grid',
  'controls',
  'chip',
  'modal',
  'sheet',
  'toast',
]) {
  test(`draws ${primitive} full-window, ready and quiet`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(`${demoUrl}?frame=${primitive}`)
    await expect(page.locator('html')).toHaveAttribute('data-ready', '')
    // The wrapper holds fixed-position layers, so it has no box of its own: check it is there.
    await expect(page.locator(`[data-demo="${primitive}"]`)).toBeAttached()
    expect(errors).toEqual([])
  })
}

test('shows the gallery at every reference size', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(`${demoUrl}?show=error`)
  await expect(page.locator('iframe[data-size]').first()).toBeVisible()
  expect(await page.locator('iframe[data-size]').count()).toBeGreaterThan(20)
  expect(errors).toEqual([])
})
