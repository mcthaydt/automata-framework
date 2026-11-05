// render3d-meshes under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples`
// projects) and WebKit (`examples-webkit`). Headless Firefox in this container has no WebGL, so the 3D renderer
// refuses it there; the GPU runner covers Firefox (M3.1b).
import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const origin = `http://localhost:${examplesPort}`
const gameUrl = `${origin}/render3d/meshes/`
const ID = 'render3d-meshes'

/** Distinct colours on the game's canvas, read in an animation frame right after the game drew it. */
const canvasColours = (frame: Frame): Promise<number> =>
  frame.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve(0)
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray()
          const colours = new Set<number>()
          for (let i = 0; i < data.length; i += 4)
            colours.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0))
          resolve(colours.size)
        })
      }),
  )

/** The share of the canvas's pixels within 2 of the sky colour (0xc7dcd0, the example's `backgroundColor`). */
const skyShare = (frame: Frame): Promise<number> =>
  frame.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          if (canvas === null) return resolve(0)
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context?.drawImage(canvas, 0, 0)
          const data = context?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray()
          let sky = 0
          for (let i = 0; i < data.length; i += 4)
            if (
              Math.abs((data[i] ?? 0) - 0xc7) <= 2 &&
              Math.abs((data[i + 1] ?? 0) - 0xdc) <= 2 &&
              Math.abs((data[i + 2] ?? 0) - 0xd0) <= 2
            )
              sky++
          resolve(sky / Math.max(1, data.length / 4))
        })
      }),
  )

async function play(frame: Frame): Promise<void> {
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
}

test('draws the boxes and both model files under the CSP, with no errors', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await play(frame)
  // Lit, textured meshes shade into many colours; a blank or single-colour field would be a handful.
  await expect.poll(() => canvasColours(frame)).toBeGreaterThan(40)
  // The sky fills the field behind the meshes (it was the letterbox's black field before 2026-10-30); in portrait the
  // field is a band of the screen, so the share is lower there (0.24 on a Pixel 7, 0.30+ in landscape).
  await expect.poll(() => skyShare(frame)).toBeGreaterThan(0.15)
  expect(errors).toEqual([])
})

// D3-f: a damaged model file stops boot with the panel naming it; Try again fetches it again and boots. Standalone,
// not in the fake host's frame: @ruken/sdk-host answers one hello per frame load (it re-arms only on a reload), so a
// Try again inside a Ruken frame never gets a second session. That holds for every boot failure, not only this one,
// and is reported to the Owner with M3.4a.
test('shows ModelInvalid naming a malformed .glb, and Try again reloads it', async ({ page }) => {
  let served = 0
  await page.route('**/nightstand*.glb', async (route) => {
    served += 1
    if (served === 1)
      await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: 'not a model' })
    else await route.continue()
  })
  await page.goto(gameUrl)
  const frame = page.mainFrame()

  const alert = frame.getByRole('alert')
  await expect(alert).toHaveAttribute('data-code', 'model-invalid')
  await expect(alert).toContainText('nightstand')
  await expect(alert).toContainText('.glb')

  await frame.getByRole('button', { name: 'Try again' }).click()
  // Ready comes after the renderer read every model, so the file fetched again parsed.
  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')
  expect(served).toBe(2)
  await expect(frame.getByRole('alert')).toHaveCount(0)
})
