import { expect, type Locator, type Page } from '@playwright/test'

/** Whether a row can be pressed now: on the page, and not inside the closed sheet, which keeps its rows but is inert. */
async function reachable(row: Locator): Promise<boolean> {
  return (await row.isVisible()) && !(await row.evaluate((element) => element.closest('[inert]') !== null))
}

/**
 * Presses a button (or a radio) of the open editor's list. Below the wide layout the list is in a sheet behind the top
 * bar's Panel button, which is opened first and closed after.
 */
export async function pressInList(
  page: Page,
  name: string | RegExp,
  role: 'button' | 'radio' = 'button',
): Promise<void> {
  const button = page.getByRole(role, { name }).first()
  const panel = page.getByRole('button', { name: 'Panel', exact: true })
  // An editor may still be opening (the Studio loads its figures first), so give it time.
  await expect(button.or(panel).first()).toBeAttached({ timeout: 30_000 })
  await expect.poll(async () => (await panel.isVisible()) || (await reachable(button))).toBe(true)
  let opened = false
  if ((await panel.isVisible()) && !(await reachable(button))) {
    if ((await panel.getAttribute('aria-expanded')) !== 'true') await panel.click()
    await expect.poll(() => reachable(button)).toBe(true)
    opened = true
  }
  await button.click()
  if (opened) {
    // The sheet stays up over the page after a choice, so a person closes it with the same button; it then slides
    // away, and the next call must find the list gone, not on its way out.
    if ((await panel.getAttribute('aria-expanded')) === 'true') await panel.click()
    await expect(panel).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => reachable(button)).toBe(false)
  }
}

/** Opens the sheet that holds the open editor's panel where there is one, and leaves it open (a wide screen has none). */
export async function openPanel(page: Page): Promise<void> {
  const panel = page.getByRole('button', { name: 'Panel', exact: true })
  if (!(await panel.isVisible())) return
  if ((await panel.getAttribute('aria-expanded')) !== 'true') await panel.click()
  await expect(panel).toHaveAttribute('aria-expanded', 'true')
}

/** Closes that sheet again, so the canvas is whole before a tap lands on it. */
export async function closePanel(page: Page): Promise<void> {
  const panel = page.getByRole('button', { name: 'Panel', exact: true })
  if (!(await panel.isVisible())) return
  if ((await panel.getAttribute('aria-expanded')) === 'true') await panel.click()
  await expect(panel).toHaveAttribute('aria-expanded', 'false')
}
