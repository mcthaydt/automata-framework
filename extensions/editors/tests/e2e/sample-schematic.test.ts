import { expect, test } from '@playwright/test'

// A person trying the editors on the site opens Schematic, lengthens how far the guard sees, and takes it back with
// Undo. The page has no server behind it, so the game is the sample held in memory.
test('Schematic on the sample game: the guard sees further, then Undo puts it back', async ({ page }) => {
  await page.goto('/suite.html')
  await page.getByText('Schematic', { exact: true }).last().click()
  await page.getByText('Hall', { exact: true }).first().click()
  await expect(page.getByRole('region', { name: 'Schematic' })).toBeVisible()

  const field = page.getByLabel('Sees up to', { exact: true }).first()
  // A phone shows the inspector as a sheet, opened from Details.
  if (!(await field.isVisible())) await page.getByRole('button', { name: 'Details' }).click()
  await expect(field).toHaveValue('4.5')
  await field.fill('7')
  await field.press('Tab')
  // The first change to a game names itself: the page asks what to call it before it writes.
  const naming = page.getByRole('dialog', { name: 'Name this change' })
  await naming.getByRole('textbox', { name: 'Title' }).fill('Guard sees further')
  await naming.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('button', { name: 'Undo Change what it notices' })).toBeEnabled()
  await expect(field).toHaveValue('7')

  await page.getByRole('button', { name: 'Undo Change what it notices' }).click()
  const again = page.getByLabel('Sees up to', { exact: true }).first()
  if (!(await again.isVisible())) await page.getByRole('button', { name: 'Details' }).click()
  await expect(again).toHaveValue('4.5')
  await page.screenshot({ path: test.info().outputPath('after-undo.png') })
})
