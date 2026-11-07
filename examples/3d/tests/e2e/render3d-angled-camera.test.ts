// render3d-angled-camera under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples`
// projects) and WebKit (`examples-webkit`): the angled camera on a walking player in a room whose near walls are cut
// away, under its ceiling, with a pillar that fades. Headless Firefox in this container has no WebGL; the GPU runner
// covers Firefox (M3.1b).
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/render3d/angled-camera/`
const ID = 'render3d-angled-camera'

/** The share of the canvas's pixels that are the player's yellow (0xffbc4e, lit and shaded down to a darker orange). */
const playerShare = (frame: Frame): Promise<number> =>
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
          let yellow = 0
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
            if (r > 100 && g > 70 && b < 90 && r > b + 60 && g > b + 25) yellow += 1
          }
          resolve(yellow / (data.length / 4))
        })
      }),
  )

/** The share of the canvas's pixels within 2 of the sky colour (0xcdd2da, the example's `backgroundColor`). */
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
              Math.abs((data[i] ?? 0) - 0xcd) <= 2 &&
              Math.abs((data[i + 1] ?? 0) - 0xd2) <= 2 &&
              Math.abs((data[i + 2] ?? 0) - 0xda) <= 2
            )
              sky++
          resolve(sky / Math.max(1, data.length / 4))
        })
      }),
  )

test('shows the walking player in its room, under the CSP, with no errors', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The player stands inside the room and shows on the canvas. This proves the example draws it through the scenery,
  // not which walls the rule cut: the unit sweeps and `occluders.parity.test.ts` prove that.
  // On a phone the figure is small (about 0.2% of the canvas).
  await expect.poll(() => playerShare(frame)).toBeGreaterThan(0.0005)
  // The sky fills the field around the room (it was the letterbox's black field before 2026-10-30).
  await expect.poll(() => skyShare(frame)).toBeGreaterThan(0.15)
  expect(errors).toEqual([])
})
