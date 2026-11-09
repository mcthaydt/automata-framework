// cutscenes-door-and-lamp under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/cutscenes/door-and-lamp/`
const ID = 'cutscenes-door-and-lamp'

test('plays the scene: the lamp warms and the door opens, then it ends, under the CSP', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The scene says where it is on the canvas: the lamp below full and the door shut at first, the lamp full and the door open at the end.
  await expect(canvas).toHaveAttribute('data-cutscene', 'playing')
  await expect(canvas).toHaveAttribute('data-door', '0')
  await expect(canvas).toHaveAttribute('data-lamp', /^0\./)
  await expect(canvas).toHaveAttribute('data-cutscene', 'done', { timeout: 20_000 })
  await expect(canvas).toHaveAttribute('data-door', '1')
  await expect(canvas).toHaveAttribute('data-lamp', '1')
  expect(errors).toEqual([])
})
