// roomvisibility-zones under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/roomvisibility/zones/`
const ID = 'roomvisibility-zones'

test('shows the rooms a camera zone sees, holds the old zone briefly, and V draws every room, under the CSP', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await expect(canvas).toHaveAttribute('data-rooms', 'corridor,reception')
  // The closet's zone sees the supply room alone; the hall's rooms are held for a third of a second, then go.
  await page.keyboard.press('3')
  await expect(canvas).toHaveAttribute('data-zone', 'closet')
  await expect(canvas).toHaveAttribute('data-rooms', 'supply')
  await page.keyboard.press('2')
  await expect(canvas).toHaveAttribute('data-rooms', 'corridor')
  await page.keyboard.press('v')
  await expect(canvas).toHaveAttribute('data-rooms', 'all')
  expect(errors).toEqual([])
})
