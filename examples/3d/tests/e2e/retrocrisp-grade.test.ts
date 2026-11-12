// retrocrisp-grade under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automataframework/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automataframework/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/retrocrisp/grade/`
const ID = 'retrocrisp-grade'

test('draws the room through the retro grade, and R switches the pass off and on, under the CSP', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await expect(canvas).toHaveAttribute('data-retro', 'true')
  await page.keyboard.press('r')
  await expect(canvas).toHaveAttribute('data-retro', 'false')
  await page.keyboard.press('r')
  await expect(canvas).toHaveAttribute('data-retro', 'true')
  expect(errors).toEqual([])
})
