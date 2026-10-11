import { collectErrors, openHosted } from '@af-examples/demo-host/testing'
import { expect, test } from '@playwright/test'
import { GAME_ID, url } from './origin.ts'

// The physics demo under the fake host, with Ruken's headers: Rapier's wasm loads under Ruken's CSP, the
// bodies fall and collide, and a drop adds one more.

test('boots under the fake host, ready and quiet; bodies collide, and a drop adds one', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, url, GAME_ID)
  const game = frame.locator('#game')
  await expect(game).toHaveAttribute('data-bodies', '7')
  // The starting crates and stones land.
  await expect.poll(async () => Number(await game.getAttribute('data-bumps'))).toBeGreaterThan(0)
  await frame.locator('canvas').click()
  await page.keyboard.press('KeyX')
  await expect(game).toHaveAttribute('data-bodies', '8')
  expect(errors).toEqual([])
})
