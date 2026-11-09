// worldkit-generated-map under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/worldkit/generated-map/`
const ID = 'worldkit-generated-map'

test('draws the apartment the kit generates, furnished, under the CSP', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The scene says what it drew: a corridor and four to six rooms (more with the ramp and the landing), and their furniture.
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-sectors')), { timeout: 15_000 })
    .toBeGreaterThan(5)
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-pieces')), { timeout: 15_000 })
    .toBeGreaterThan(200)
  await expect(canvas).toHaveAttribute('data-problems', '0')
  expect(errors).toEqual([])
})
