// figures-outfits-items under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples`
// projects) and WebKit (`examples-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/figures/outfits-items/`
const ID = 'figures-outfits-items'

/**
 * The game canvas's cloak-blue pixels (the cloak, the cape and the trousers: blue well over red) and its brass
 * pixels (the lamp's cap and base: red well over blue, which nothing else in the scene is).
 */
const look = (frame: Frame): Promise<{ blue: number; brass: number }> =>
  frame.evaluate(
    () =>
      new Promise<{ blue: number; brass: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve({ blue: 0, brass: 0 })
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray()
          let blue = 0
          let brass = 0
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
            if (b > 90 && b > r + 50 && b > g + 10) blue++
            if (r > 150 && r > g + 30 && r > b + 50) brass++
          }
          resolve({ blue, brass })
        })
      }),
  )

test('draws Wick under the CSP, changing outfits and picking the lamp up and putting it down', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // Every two seconds the lamp comes or goes, and the outfit changes every four: within one cycle (8 s) the cloak
  // shows much more blue than the shirt, and the lamp's brass shows and then does not.
  const seen: { blue: number; brass: number }[] = []
  await expect
    .poll(
      async () => {
        seen.push(await look(frame))
        const blues = seen.map((s) => s.blue)
        const brasses = seen.map((s) => s.brass)
        return (
          Math.max(...blues) > 2 * Math.min(...blues) + 100 &&
          Math.max(...brasses) > 20 &&
          Math.min(...brasses) < 5
        )
      },
      { timeout: 20_000, intervals: [250] },
    )
    .toBe(true)
  expect(errors).toEqual([])
})
