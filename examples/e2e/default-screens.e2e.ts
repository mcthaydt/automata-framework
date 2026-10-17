import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

// The game package's default screens in a real browser, on the real Pixi renderer, under the fake host (DX.2
// plan step 8): title → play → paused → play → title. The smoke (examples.e2e.ts) proves every example reaches
// ready; this walks the screens once, on the example with an input map.
const origin = `http://localhost:${examplesPort}`

test('core-input-keys walks title, play, paused and back on the default screens', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/input-keys/`, 'core-input-keys')
  const screen = (id: string) => frame.getByTestId(`${id}-screen`)

  await expect(screen('title')).toBeVisible()
  await expect(frame.getByTestId('play')).toBeFocused()
  await expect(frame.locator('[data-layer="stage"] canvas')).toHaveCount(1)

  await frame.getByTestId('play').click()
  await expect(screen('play')).toBeVisible()
  await expect(frame.getByTestId('pause')).toBeVisible()
  // Both projects are phones with a coarse pointer, so the input map's touch buttons show.
  await expect(frame.getByTestId('move-0')).toBeVisible()

  await frame.getByTestId('pause').click()
  await expect(screen('paused')).toBeVisible()
  await expect(frame.getByTestId('resume')).toBeFocused()

  await frame.getByTestId('resume').click()
  await expect(screen('play')).toBeVisible()

  await frame.getByTestId('pause').click()
  await frame.getByTestId('quit').click()
  await expect(screen('title')).toBeVisible()
  expect(errors).toEqual([])
})

// The draw layer (PRODUCT.2) on the real renderer: shapes-draw-hud draws its HUD every frame of play, and the
// play, pause and quit walk stays free of console errors. The pixels are proven by the game package's browser
// parity test (`draw-layer.parity.test.ts`).
test('shapes-draw-hud draws through play, pause and quit with no errors', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/shapes/draw-hud/`, 'shapes-draw-hud')
  const screen = (id: string) => frame.getByTestId(`${id}-screen`)

  await expect(screen('title')).toBeVisible()
  await frame.getByTestId('play').click()
  await expect(screen('play')).toBeVisible()
  // Ten display frames of play, each one calling draw.
  await frame.locator('body').evaluate(
    () =>
      new Promise<void>((resolve) => {
        let left = 10
        const next = (): void => {
          left--
          if (left === 0) resolve()
          else requestAnimationFrame(next)
        }
        requestAnimationFrame(next)
      }),
  )

  await frame.getByTestId('pause').click()
  await expect(screen('paused')).toBeVisible()
  await frame.getByTestId('quit').click()
  await expect(screen('title')).toBeVisible()
  expect(errors).toEqual([])
})
