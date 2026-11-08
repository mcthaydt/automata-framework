import { expect, type Page } from '@playwright/test'

/**
 * Presses a button of the open editor's list. Below the wide layout the list is in a sheet behind the top bar's Panel
 * button, which is opened first and closed after.
 */
export async function pressInList(page: Page, name: string | RegExp): Promise<void> {
  const button = page.getByRole('button', { name }).first()
  const panel = page.getByRole('button', { name: 'Panel', exact: true })
  await expect(button.or(panel).first()).toBeVisible()
  let opened = false
  if ((await panel.isVisible()) && !(await button.isVisible())) {
    if ((await panel.getAttribute('aria-expanded')) !== 'true') await panel.click()
    await expect(button).toBeVisible()
    opened = true
  }
  await button.click()
  if (opened) {
    // The sheet stays up over the page after a choice, so a person closes it with the same button; it then slides
    // away, and the next call must find the list gone, not on its way out.
    if ((await panel.getAttribute('aria-expanded')) === 'true') await panel.click()
    await expect(panel).toHaveAttribute('aria-expanded', 'false')
    await expect(button).toBeHidden()
  }
}
