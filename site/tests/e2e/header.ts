import type { Page } from '@playwright/test'

/**
 * Opens the editor the way a visitor does: the header's Editor link, in the bar where it fits and in the Menu where the
 * links are folded (a phone). The link goes straight to the editor at /editor/app/; there is no page in between.
 */
export async function openEditorFromHeader(page: Page): Promise<void> {
  const inBar = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Editor' })
  if (await inBar.isVisible()) {
    await inBar.click()
    return
  }
  await page.locator('summary[aria-label="Menu"]').click()
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Editor' })
    .click()
}
