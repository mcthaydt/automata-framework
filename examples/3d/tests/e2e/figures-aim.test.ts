// figures-aim under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples` projects)
// and WebKit (`examples-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted, sampleForSimTicks } from '@automata/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/figures/aim/`
const ID = 'figures-aim'

/**
 * The game canvas's cloak-blue pixels (Wick's cloak and cape: blue well over red) and a hash of where its orb pixels
 * (strong red, which nothing else in the scene is) are.
 */
const cloak = (frame: Frame): Promise<{ count: number; orb: number; where: number }> =>
  frame.evaluate(
    () =>
      new Promise<{ count: number; orb: number; where: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve({ count: 0, orb: 0, where: 0 })
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray()
          let count = 0
          let orb = 0
          let where = 0
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
            if (b > 90 && b > r + 50 && b > g + 10) count++
            if (r > 160 && r > g + 80 && r > b + 80) {
              orb++
              where = (where * 31 + i) | 0
            }
          }
          resolve({ count, orb, where })
        })
      }),
  )

// One lap of the orb is 360 ticks (6 s of sim time). The journey watches a lap and a half of the sim's own clock, so a
// machine that draws a frame a second (the loop runs 0.1 s of sim a frame) sees the same orbit as a fast one.
const LAP_TICKS = 360

test('draws Wick under the CSP with the orb he watches circling him', async ({ page }) => {
  test.setTimeout(150_000)
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  const seen = await sampleForSimTicks(frame, LAP_TICKS * 1.5, () => cloak(frame))
  // The cloak and cape are blue and nothing else in the scene is: a drawn figure is a few hundred such pixels.
  expect(Math.max(...seen.map((s) => s.count))).toBeGreaterThan(200)
  expect(Math.max(...seen.map((s) => s.orb))).toBeGreaterThan(10)
  // The orb circles, so its pixels move between frames (Wick's head, chest and hand follow it).
  expect(new Set(seen.map((s) => s.where)).size).toBeGreaterThan(2)
  expect(errors).toEqual([])
})
