import { expect, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'

// Spec 10.2 and 18.3: the Editor page shows what the editor does and opens the try-it editor, the same build
// `automata editor` serves, which starts on this browser's storage under the site's headers with nothing wrong in the
// console.
test('the Editor page shows three pictures and opens the try-it editor on browser storage', async ({
  page,
}) => {
  const watch = watchPage(page, `http://127.0.0.1:${SITE_PORT}`)
  await page.goto('/editor')
  await expect(page.locator('main figure')).toHaveCount(3)
  await page.getByRole('link', { name: 'Try the editor' }).click()
  await expect(page).toHaveURL(/\/editor\/app\/$/)
  await expect(page.getByRole('heading', { name: 'Your levels' })).toBeVisible()
  await expect(page.getByText('Saved in this browser.', { exact: false })).toBeVisible()

  // A level made from the platformer template is still there after a reload.
  await page.getByRole('button', { name: 'New level' }).first().click()
  await page.getByText('Platformer').click()
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Untitled platformer').first()).toBeVisible()
  expect(watch.problems).toEqual([])
})
