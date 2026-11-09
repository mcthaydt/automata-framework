// figures-clips under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples` projects)
// and WebKit (`examples-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automataframework/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automataframework/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/figures/clips/`
const ID = 'figures-clips'

/** The game canvas's cloak-blue pixels (Wick's cloak and cape: blue well over red) and a hash of where they are. */
const cloak = (frame: Frame): Promise<{ count: number; where: number }> =>
  frame.evaluate(
    () =>
      new Promise<{ count: number; where: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve({ count: 0, where: 0 })
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray()
          let count = 0
          let where = 0
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
            if (b > 90 && b > r + 50 && b > g + 10) {
              count++
              where = (where * 31 + i) | 0
            }
          }
          resolve({ count, where })
        })
      }),
  )

test('draws Wick under the CSP and clips play over the walk', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The cloak and cape are blue and nothing else in the scene is: a drawn figure is a few hundred such pixels.
  await expect.poll(async () => (await cloak(frame)).count, { timeout: 15_000 }).toBeGreaterThan(200)
  // Walking with a reach, a look or a flinch over it, the cloak's pixels move between frames.
  const seen = new Set<number>()
  await expect
    .poll(
      async () => {
        seen.add((await cloak(frame)).where)
        return seen.size
      },
      { timeout: 10_000, intervals: [250] },
    )
    .toBeGreaterThan(2)
  expect(errors).toEqual([])
})
