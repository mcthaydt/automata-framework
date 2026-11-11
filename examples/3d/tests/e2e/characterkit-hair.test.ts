// characterkit-hair under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'
import { coloursPerThird } from './colours.ts'

const gameUrl = `http://localhost:${examples3dPort}/characterkit/hair/`
const ID = 'characterkit-hair'

test('draws three figures in the kit hairstyles under the CSP, one in each third', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // A bare third is the sky and the floor and a dither between them; a third with a figure in it is many colours more.
  await expect
    .poll(async () => Math.min(...(await coloursPerThird(frame))), { timeout: 15_000 })
    .toBeGreaterThan(14)
  expect(errors).toEqual([])
})
