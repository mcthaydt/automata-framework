import { expect, type Page } from '@playwright/test'

/** The Editor page, "Open the editors", then a first game named `name`: what a visitor with no games does. */
export async function makeGame(page: Page, name: string): Promise<void> {
  await page.goto('/editor')
  await page.getByRole('link', { name: 'Open the editors' }).click()
  await expect(page).toHaveURL(/\/editor\/app\/$/)
  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByLabel('What’s your game called?').fill(name)
  await page.getByRole('button', { name: 'Make my game' }).click()
  await expect(page.getByRole('link', { name: `${name}: all your games` })).toBeVisible()
}
