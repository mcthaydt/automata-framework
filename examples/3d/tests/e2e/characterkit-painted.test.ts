// characterkit-painted under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'
import { coloursPerThird } from './colours.ts'

const gameUrl = `http://localhost:${examples3dPort}/characterkit/painted/`
const ID = 'characterkit-painted'

test('draws the painted pair under the CSP, a figure in the middle third', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // A bare third is the sky and the floor; the middle third, where the pair stand, is many colours more (the painter's).
  await expect.poll(async () => (await coloursPerThird(frame))[1], { timeout: 15_000 }).toBeGreaterThan(14)
  // By the end of the first lap (eleven seconds of play) the walker has gone behind the low wall and out again.
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-lap', '1', { timeout: 60_000 })
  expect(errors).toEqual([])
})
