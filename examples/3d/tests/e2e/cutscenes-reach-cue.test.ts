// cutscenes-reach-cue under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/cutscenes/reach-cue/`
const ID = 'cutscenes-reach-cue'

test('plays the scene: the man walks, his reach cue starts once, then it ends, under the CSP', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The scene says where it is on the canvas: no clip at first, the reach once its cue is passed, and how often a clip started.
  await expect(canvas).toHaveAttribute('data-cutscene', 'playing')
  await expect(canvas).toHaveAttribute('data-clip', '')
  await expect(canvas).toHaveAttribute('data-clip', 'reach', { timeout: 20_000 })
  await expect(canvas).toHaveAttribute('data-cutscene', 'done', { timeout: 20_000 })
  await expect(canvas).toHaveAttribute('data-cues', '1')
  expect(errors).toEqual([])
})
