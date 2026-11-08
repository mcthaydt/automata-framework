import { expect, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'

// Spec 10.2 and 18.3: the Editor page shows what the editor does and opens the try-it editor, the same page
// `automata editor` serves, which starts on a sample game held in the page under the site's headers with nothing wrong
// in the console. Nothing is kept there: Share is how a level leaves.
test('the Editor page shows three pictures and opens the try-it editor on a sample game', async ({
  page,
}) => {
  const watch = watchPage(page, `http://127.0.0.1:${SITE_PORT}`)
  await page.goto('/editor')
  await expect(page.locator('main figure')).toHaveCount(3)
  await page.getByRole('link', { name: 'Try the editor' }).click()
  await expect(page).toHaveURL(/\/editor\/app\/$/)
  await expect(page.getByText('This is a sample game, not yours.', { exact: false })).toBeVisible()

  // A level made from the platformer template draws, and Share is how it leaves.
  await page.getByRole('button', { name: 'New level' }).click()
  await page.getByRole('button', { name: /Platformer/ }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
  expect(watch.problems).toEqual([])
})
