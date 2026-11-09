// worldkit-sky under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/worldkit/sky/`
const ID = 'worldkit-sky'

test('draws the street at night with the look’s sky, glow and rain, under the CSP', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The scene says which time of day it is lit as and which of the look's passes it runs.
  await expect(canvas).toHaveAttribute('data-time', 'night')
  await expect(canvas).toHaveAttribute('data-passes', 'SkyEffect,GlowEffect,RainEffect')
  expect(errors).toEqual([])
})
