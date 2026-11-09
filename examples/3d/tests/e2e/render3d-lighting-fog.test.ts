// render3d-lighting-fog under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples`
// projects) and WebKit (`examples-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automataframework/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automataframework/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const origin = `http://localhost:${examples3dPort}`
const gameUrl = `${origin}/render3d/lighting-fog/`
const ID = 'render3d-lighting-fog'

/**
 * The game canvas's distinct colours and its warm pixels (red over 100 and well over blue: the warm lamp's yellow,
 * which nothing else in the room is), read in an animation frame after a draw.
 */
const canvasStats = (frame: Frame): Promise<{ colours: number; warm: number }> =>
  frame.evaluate(
    () =>
      new Promise<{ colours: number; warm: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve({ colours: 0, warm: 0 })
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray()
          const colours = new Set<number>()
          let warm = 0
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
            colours.add((r << 16) | (g << 8) | b)
            if (r > 100 && r > b + 40) warm++
          }
          resolve({ colours: colours.size, warm })
        })
      }),
  )

test('draws the baked room, the lit walker and fog under the CSP, and the lamp switch changes the light', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // Vertex light, the tint and fog shade the room into many colours; an unlit or blank field would be a handful.
  await expect.poll(async () => (await canvasStats(frame)).colours).toBeGreaterThan(40)
  // D3-e in the example: the sim switches the warm lamp off for one second in every two. Lit, its pool and the
  // walker under it are hundreds of warm pixels; off, there are none to speak of. Both states show within seconds.
  const seen: number[] = []
  await expect
    .poll(
      async () => {
        seen.push((await canvasStats(frame)).warm)
        return Math.max(...seen) > 500 && Math.min(...seen) < 50
      },
      { timeout: 15_000, intervals: [200] },
    )
    .toBe(true)
  expect(errors).toEqual([])
})
