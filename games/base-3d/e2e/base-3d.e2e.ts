import { expect, type Frame, type Page, test } from '@playwright/test'
import { hostedUrl } from '../../../tooling/examples-runner/host/ports.ts'
import { collectErrors, openHosted } from '../../../tooling/examples-runner/host/testing.ts'
import { gameUrl } from './origin.ts'

// base-3d in a real browser (M3.7b part 4, B-b): its build served from /b/<buildId>/ with the headers Ruken would
// serve it with (vite.config.ts, compileHeaders: no eval), standalone and inside the shared fake Ruken host on
// another origin. Every journey fails on any console error, CSP violations included.

const GAME_ID = 'base-3d'

/** The screen the runtime's flow shows: it marks each screen's layer with its id. */
const screen = (target: Page | Frame, id: string) =>
  target.locator(`[data-layer="screens"] [data-screen="${id}"]`)

/**
 * How long one step may take once play draws: the headless shell draws WebGL2 in software, a frame or more a
 * second (Emberwick's journeys measured up to 3.8 s a frame on a loaded machine, ROOM_STEP_MS there).
 */
const PLAY_STEP_MS = 40_000

/**
 * A phone held sideways and standalone plays fullscreen or not at all (M4.7): the landscape gate covers the game
 * until the player taps its fullscreen button. Elsewhere the gate never shows.
 */
async function passLandscapeGate(page: Page) {
  const viewport = page.viewportSize()
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  const gate = page.getByTestId('landscape-gate-fullscreen')
  if (!coarse || viewport === null || viewport.width <= viewport.height) {
    await expect(gate).toHaveCount(0)
    return
  }
  await gate.tap()
  await expect(page.getByTestId('landscape-gate')).toHaveCount(0)
}

test('boots standalone under Ruken’s headers: the splash, then the menu with Play focused', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const response = await page.goto(gameUrl)
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await passLandscapeGate(page)
  await expect(page.locator('canvas')).toBeVisible()
  // The splash moves on by itself.
  await expect(screen(page, 'title')).toBeAttached()
  await expect(page.getByRole('button', { name: 'Play' })).toBeFocused()
  expect(errors).toEqual([])
})

test('inside the fake host on another origin: the handshake, the menu, play and pause', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, GAME_ID)
  const trace = await page.evaluate(() => (window as unknown as { hostTrace: () => string[] }).hostTrace())
  expect(trace.slice(0, 3)).toEqual(['hello', 'welcome', 'session.ready'])
  await frame.locator('body').press('KeyX')
  await expect(screen(frame, 'title')).toBeAttached()
  await frame.getByRole('button', { name: 'Play' }).click()
  await expect(screen(frame, 'play')).toBeAttached({ timeout: PLAY_STEP_MS })
  await expect(frame.locator('canvas')).toBeVisible({ timeout: PLAY_STEP_MS })
  await frame.locator('body').press('Escape', { timeout: PLAY_STEP_MS })
  await expect(screen(frame, 'paused')).toBeAttached({ timeout: PLAY_STEP_MS })
  expect(errors).toEqual([])
})

// The runtime makes the renderer before it waits on ready (its boot steps 6 and 7), so a canvas is there; what must
// not happen before ready is a screen or a frame of play: the loader covers the page and no screen opens.
test('opens no screen while the host has not said ready', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto(hostedUrl(gameUrl, GAME_ID, { ready: 'never' }))
  const trace = () => page.evaluate(() => (window as unknown as { hostTrace: () => string[] }).hostTrace())
  // The game has said hello and been welcomed: it is waiting on ready.
  await expect.poll(async () => (await trace()).includes('welcome')).toBe(true)
  const frame = page.frames().find((candidate) => candidate.url().startsWith(gameUrl)) as Frame
  await expect(frame.getByTestId('loader-overlay')).toBeVisible()
  expect(await frame.locator('html').getAttribute('data-state')).toBe('loading')
  await expect(frame.locator('[data-layer="screens"] [data-screen]')).toHaveCount(0)
  expect(errors).toEqual([])
})
