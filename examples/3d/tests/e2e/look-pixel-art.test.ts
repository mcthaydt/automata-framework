// look-pixel-art under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/look/pixel-art/`
const ID = 'look-pixel-art'

/** What the game canvas shows, counted in the page right after the game drew it (a canvas is too big to send over). */
interface Seen {
  /** Wick's cloak (blue well over red; nothing else in the scene is) in the left, middle and right third. */
  readonly blue: [number, number, number]
  /** Distinct colours. */
  readonly colours: number
  /** The mean of red, green and blue, 0 to 255. */
  readonly brightness: number
}
const seen = (frame: Frame): Promise<Seen> =>
  frame.evaluate(
    () =>
      new Promise<Seen>((resolve) => {
        requestAnimationFrame(() => {
          const empty: Seen = { blue: [0, 0, 0], colours: 0, brightness: 0 }
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve(empty)
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data
          if (data === undefined) return resolve(empty)
          const blue: [number, number, number] = [0, 0, 0]
          const colours = new Set<number>()
          let total = 0
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
            colours.add((r << 16) | (g << 8) | b)
            total += (r + g + b) / 3
            if (b > 90 && b > r + 50 && b > g + 10)
              blue[Math.min(2, Math.floor((((i / 4) % copy.width) / copy.width) * 3))]++
          }
          resolve({ blue, colours: colours.size, brightness: total / (data.length / 4) })
        })
      }),
  )

test('draws the pixel-art look under the CSP: few colours, in hard-edged blocks', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The colours snap to the DUEL palette (32 ramps of 8) and the look draws hard-edged blocks: a smooth 3D render of
  // this scene holds thousands of distinct colours.
  await expect.poll(async () => (await seen(frame)).colours, { timeout: 15_000 }).toBeGreaterThan(3)
  expect((await seen(frame)).colours).toBeLessThanOrEqual(256)
  expect(errors).toEqual([])
})
