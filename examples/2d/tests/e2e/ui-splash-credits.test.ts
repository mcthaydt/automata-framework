import { examplesPort } from '@automataframework/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automataframework/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

// A studio splash, then a title with a Credits panel (shared polish, item 5). The splash is an opening step: any press
// goes on. Credits link through the host, and the examples' fake Ruken host answers Cancel to a link, so the panel
// says the page could not be opened and stays; Escape closes it and focus is back on Credits.
const origin = `http://localhost:${examplesPort}`

test('splash, then the title; Credits lists names, a refused link is said, Escape closes', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/ui/splash-credits/`, 'ui-splash-credits')

  await expect(frame.getByRole('img', { name: 'Studio' })).toBeVisible()
  await frame.getByTestId('splash-screen').click()
  await expect(frame.getByTestId('title-screen')).toBeVisible()

  await frame.getByTestId('credits').click()
  await expect(frame.getByTestId('credits-panel')).toBeVisible()
  await expect(frame.getByTestId('credits-panel')).toContainText('Ada')

  // The host asks the player and the fake host's player says no.
  await frame.getByTestId('credits-link-0-0').click()
  await expect(frame.getByTestId('credits-note')).not.toBeEmpty()
  await expect(frame.getByTestId('credits-panel')).toBeVisible()

  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('credits-panel')).toHaveCount(0)
  await expect(frame.getByTestId('credits')).toBeFocused()
  expect(errors).toEqual([])
})
