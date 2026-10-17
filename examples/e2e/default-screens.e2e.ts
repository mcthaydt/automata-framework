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
  await expect(frame.getByTestId('touch-0')).toBeVisible()

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
