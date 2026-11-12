// worldkit-sky under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automataframework/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automataframework/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/worldkit/sky/`
const ID = 'worldkit-sky'

test('draws the street at night with the stars, rain and glow passes of the kit, under the CSP', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The scene says which time of day it is lit as and which passes it added; a pass added twice is refused by core.
  await expect(canvas).toHaveAttribute('data-time', 'night')
  await expect(canvas).toHaveAttribute('data-passes', 'world-kit:stars,world-kit:glow,world-kit:rain')
  // A WebGL feedback loop shows only from the second frame the look presents, and a shader it cannot link is reported
  // as that frame draws. The scene counts the frames it has presented, so wait for the second and one more instead of
  // for a fixed number of animation frames, which a software renderer takes tens of seconds to draw.
  await expect(canvas).toHaveAttribute('data-frames', /^(?:[3-9]|\d{2,})$/)
  expect(errors).toEqual([])
})
