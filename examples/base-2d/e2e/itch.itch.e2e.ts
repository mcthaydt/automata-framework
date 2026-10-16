import { expect, type Page, test } from '@playwright/test'
import {
  collectErrors,
  embedUrl,
  gameFrame,
  gameUrl as harnessGameUrl,
  openAndTimeReady,
  READY_WITHIN_MS,
} from '../../../tooling/itch-harness/e2e/journeys.ts'
import { playGoldenRoute } from './golden-route.ts'
import { gameUrl as rukenGameUrl, hostOrigin as rukenHostOrigin } from './origins.ts'

// base-2d (Emberwick) as an itch build (`pnpm build:itch`) in the itch-like harness (tooling/itch-harness), and
// the same golden route in both targets: the Ruken build inside the fake Ruken host, the itch build inside the
// harness (PUB spec §5 flow 2, §12 PUB-c). The sim does not know its target, so both must end on the same hash.

test('is ready within 2 s, with no console errors', async ({ page }) => {
  const errors = collectErrors(page)
  const elapsed = await openAndTimeReady(page, embedUrl('base-2d'), 'base-2d')
  expect(elapsed, `ready after ${elapsed} ms`).toBeLessThan(READY_WITHIN_MS)
  const frame = await gameFrame(page, 'base-2d')
  await expect(frame.locator('canvas')).toBeVisible()
  await expect(frame.locator('#game')).toHaveAttribute('data-screen', /splash|menu/)
  await expect(frame.getByRole('button', { name: /^Back to/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

/**
 * Opens `url`, whose frame at `frameUrl` is the game, and plays the golden route there. Returns the hash the page
 * shows at the end and the hash a Node sim reaches on the same route.
 */
async function goldenRunIn(page: Page, url: string, frameUrl: string) {
  await page.goto(url)
  await expect.poll(() => page.frames().some((frame) => frame.url() === frameUrl)).toBe(true)
  const frame = page.frames().find((candidate) => candidate.url() === frameUrl)
  if (frame === undefined) throw new Error(`no frame at ${frameUrl}`)
  const game = frame.locator('#game')
  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')
  // The player's first click on an embed gives the game's frame focus, so the keys reach it (and the web adapter
  // stops reporting the frame as blurred). The corner is clear of every button.
  await frame.locator('body').click({ position: { x: 2, y: 2 } })
  if ((await game.getAttribute('data-screen')) === 'splash') await page.keyboard.press('KeyX')
  await expect(game).toHaveAttribute('data-screen', 'menu')
  // From here on the clock moves only when the route moves it.
  await page.clock.pauseAt((await frame.evaluate(() => Date.now())) + 1000)
  // The click took focus off Play, as a player's would, so the player taps Play.
  await frame.getByRole('button', { name: 'Play' }).click()
  await expect(game).toHaveAttribute('data-screen', 'room')
  const { expectedHash } = await playGoldenRoute(page, game)
  await expect(game).toHaveAttribute('data-screen', 'end')
  await expect(frame.locator('[data-slot="time"]')).toHaveText('5.70 s')
  return { hash: await game.getAttribute('data-hash'), expectedHash }
}

test('the golden route ends on the same sim hash in the Ruken build and the itch build', async ({ page }) => {
  // Two routes of 342 ticks, each frame stepped and read back by the test: about 20 s each in Chromium.
  test.setTimeout(120_000)
  const errors = collectErrors(page)
  await page.clock.install()
  const ruken = await goldenRunIn(page, `${rukenHostOrigin}/`, rukenGameUrl)
  // Back to wall speed for the next page's boot; the next run pauses it again.
  await page.clock.resume()
  const itch = await goldenRunIn(page, embedUrl('base-2d'), harnessGameUrl('base-2d'))

  expect(ruken.hash, 'the Ruken build, against a Node sim').toBe(ruken.expectedHash)
  expect(itch.hash, 'the itch build, against a Node sim').toBe(itch.expectedHash)
  expect(itch.hash, 'the itch build, against the Ruken build').toBe(ruken.hash)
  test.info().annotations.push({ type: 'golden hash at the goal tick', description: String(itch.hash) })
  expect(errors).toEqual([])
})
