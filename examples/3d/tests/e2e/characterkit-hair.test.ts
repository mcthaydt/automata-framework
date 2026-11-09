// characterkit-hair under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/characterkit/hair/`
const ID = 'characterkit-hair'

/** How many distinct colours the game canvas shows in its left, middle and right third (counted in the page, right after the game drew it). */
const coloursPerThird = (frame: Frame): Promise<[number, number, number]> =>
  frame.evaluate(
    () =>
      new Promise<[number, number, number]>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          const copy = document.createElement('canvas')
          const context = copy.getContext('2d')
          if (canvas === null || context === null) return resolve([0, 0, 0])
          copy.width = canvas.width
          copy.height = canvas.height
          context.drawImage(canvas, 0, 0)
          const data = context.getImageData(0, 0, copy.width, copy.height).data
          const thirds = [new Set<number>(), new Set<number>(), new Set<number>()]
          for (let i = 0; i < data.length; i += 4) {
            const third = Math.min(2, Math.floor((((i / 4) % copy.width) / copy.width) * 3))
            thirds[third]?.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0))
          }
          resolve([thirds[0]?.size ?? 0, thirds[1]?.size ?? 0, thirds[2]?.size ?? 0])
        })
      }),
  )

test('draws three figures in the kit hairstyles under the CSP, one in each third', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // A bare third is the sky and the floor and a dither between them; a third with a figure in it is many colours more.
  await expect
    .poll(async () => Math.min(...(await coloursPerThird(frame))), { timeout: 15_000 })
    .toBeGreaterThan(14)
  expect(errors).toEqual([])
})
