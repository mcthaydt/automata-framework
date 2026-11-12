import { expect, test } from '@playwright/test'
import { begin } from './driver.ts'

// The opening cutscene says its first line on the screen, typed out by the line's delivery: the caption is on screen, its typed
// part grows to the whole line, and the first line is the clinic's name and the hour. It waits on the caption itself, never on a
// sleep.

test('the opening says its first line, typed out', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await begin(page)
  const caption = page.getByTestId('cutscene-caption')
  await expect(caption).toBeVisible({ timeout: 60_000 })
  await expect(caption).toContainText('St. Agnes Clinic. 20:00.')
  // Typed: the part shown ends at the whole line (a line with a delivery shows by degrees; one without shows at once).
  await expect(page.getByTestId('cutscene-caption-typed')).toHaveText('St. Agnes Clinic. 20:00.')
  expect(errors).toEqual([])
})
