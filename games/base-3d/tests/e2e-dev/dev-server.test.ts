// The base 3D game as `pnpm dev` serves it. Vite's dev server loads every module unbundled, so a Node built-in that a
// production build tree-shakes away throws here at boot and leaves a blank page (content's root entry reaching
// `node:fs/promises` did); the journeys under e2e/ test the production build.
import { expect, test } from '@playwright/test'
import { base3dDevPort } from '../../../../tooling/examples-runner/host/ports.ts'

test('the dev server page boots with no page error: the splash, the menu, and the one canvas once play starts', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`http://localhost:${base3dDevPort}/`)
  // A phone held sideways plays fullscreen: the landscape gate waits for its button. A tablet has no gate.
  const gate = page.getByTestId('landscape-gate-fullscreen')
  const screens = page.locator('[data-layer="screens"] [data-screen]')
  await expect(gate.or(screens).first()).toBeAttached({ timeout: 60_000 })
  if (await gate.isVisible()) await gate.tap()
  await page.locator('body').press('KeyX')
  await expect(page.locator('[data-layer="screens"] [data-screen="title"]')).toBeAttached({ timeout: 60_000 })
  await page.getByTestId('save-slots-new').click()
  await expect(page.locator('[data-layer="screens"] [data-screen="play"]')).toBeAttached({ timeout: 60_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(errors).toEqual([])
})
