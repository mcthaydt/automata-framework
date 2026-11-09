// figures-poses under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples` projects)
// and WebKit (`examples-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automataframework/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automataframework/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/figures/poses/`
const ID = 'figures-poses'

/** The game canvas's cloak-blue pixels (Wick's cloak and cape: blue well over red) and the highest one's row. */
const cloak = (frame: Frame): Promise<{ count: number; top: number }> =>
  frame.evaluate(
    () =>
      new Promise<{ count: number; top: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve({ count: 0, top: 0 })
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray()
          let count = 0
          let top = copy.height
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
            if (b > 90 && b > r + 50 && b > g + 10) {
              count++
              top = Math.min(top, Math.floor(i / 4 / copy.width))
            }
          }
          resolve({ count, top })
        })
      }),
  )

test('draws Wick under the CSP and the figure changes pose', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The cloak and cape are blue and nothing else in the scene is: a drawn figure is a few hundred such pixels.
  await expect.poll(async () => (await cloak(frame)).count, { timeout: 15_000 }).toBeGreaterThan(200)
  // Every two seconds a clip blends Wick into the next pose; kneeling (the second) drops the hood's top by a third.
  const tops: number[] = []
  await expect
    .poll(
      async () => {
        tops.push((await cloak(frame)).top)
        return Math.max(...tops) - Math.min(...tops)
      },
      { timeout: 15_000, intervals: [250] },
    )
    .toBeGreaterThan(15)
  expect(errors).toEqual([])
})
