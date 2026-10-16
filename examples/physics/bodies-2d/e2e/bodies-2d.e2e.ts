import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
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

// Wick walks into the crate stack and shoves it: the rightmost crate's sprite moves right. On the demos
// project's phone (portrait), and at the 780 × 270 phone-landscape size.
for (const size of [undefined, { width: 780, height: 270 }]) {
  test.describe(size === undefined ? 'phone portrait' : '780 × 270', () => {
    if (size !== undefined) test.use({ viewport: size })

    test('walking into the crates moves a crate’s sprite', async ({ page }) => {
      const errors = await collectErrors(page)
      const frame = await openHosted(page, url, GAME_ID)
      const game = frame.locator('#game')
      // The crates land for the first half second; a shove before that only presses them down. Wait for a
      // second of sim time (as the Node shove test does), with the stack where it started, 104 px across.
      await expect.poll(async () => Number(await game.getAttribute('data-tick'))).toBeGreaterThanOrEqual(60)
      await expect(game).toHaveAttribute('data-crate-x', '104')
      await frame.locator('canvas').click()
      await page.keyboard.down('ArrowRight')
      await expect.poll(async () => Number(await game.getAttribute('data-crate-x'))).toBeGreaterThan(108)
      await page.keyboard.up('ArrowRight')
      expect(errors).toEqual([])
    })
  })
}
