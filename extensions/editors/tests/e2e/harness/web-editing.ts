// What a person does on the web page, key by key: open an editor from the rail, find a field (behind Details on a
// phone), type into it and leave the cursor where it is. Shared by the journeys that type into more than the first field.
import { expect, type Page } from '@playwright/test'

type Locator = ReturnType<Page['getByRole']>

/** Opens an editor from the rail, or from the rail's More menu when a phone's rail has no room for it. */
export async function openFromRail(page: Page, name: string): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true })
  await expect(page.getByRole('tab', { name: 'Tuner', exact: true })).toBeVisible()
  if (await tab.isVisible()) {
    await tab.click()
    return
  }
  await page
    .getByRole('tab', { name: 'More' })
    .or(page.getByRole('button', { name: 'More' }))
    .first()
    .click()
  await page.getByRole('menuitem', { name }).click()
}

/** Makes a new web game and lands in it. */
export async function newGame(page: Page, siteUrl: string, name: string): Promise<void> {
  await page.goto(siteUrl)
  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByLabel('What’s your game called?').fill(name)
  await page.getByRole('button', { name: 'Make my game' }).click()
  await expect(page.getByRole('link', { name: `${name}: all your games` })).toBeVisible()
}

/** On a phone the inspector sits behind Details. */
export async function shown(page: Page, field: Locator): Promise<void> {
  await page.waitForTimeout(800)
  if (await field.isVisible()) return
  const details = page.getByRole('button', { name: 'Details', exact: true })
  if (await details.isVisible()) await details.click()
  await expect(field).toBeVisible({ timeout: 15_000 })
}

/** Types into the field the way a person does, and leaves the cursor in it. */
export async function typeKeep(page: Page, field: Locator, text: string): Promise<void> {
  await shown(page, field)
  await field.click()
  await field.press('ControlOrMeta+A')
  await field.pressSequentially(text)
}

/** What the nth field of this kind and name reads. */
export async function readField(
  page: Page,
  role: 'textbox' | 'spinbutton',
  name: string,
  nth: number,
): Promise<string> {
  const field = page.getByRole(role, { name, exact: true }).nth(nth)
  await shown(page, field)
  return field.inputValue()
}
