// worldkit-furnished-room under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/worldkit/furnished-room/`
const ID = 'worldkit-furnished-room'

test('draws the room furnished by the kit, with nothing wrong with it, under the CSP', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The scene says what it drew: a bare room is a handful of pieces, a furnished one is many more.
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-pieces')), { timeout: 15_000 })
    .toBeGreaterThan(40)
  await expect(canvas).toHaveAttribute('data-problems', '0')
  expect(errors).toEqual([])
})
