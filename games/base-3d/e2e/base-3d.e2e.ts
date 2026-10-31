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

/** From the splash to play, by the slot list's `action` (New game or Continue). */
async function toPlay(frame: Frame, action: 'save-slots-new' | 'save-slots-load') {
  await frame.locator('body').press('KeyX')
  await expect(screen(frame, 'title')).toBeAttached()
  await frame.getByTestId(action).click()
  await expect(screen(frame, 'play')).toBeAttached({ timeout: PLAY_STEP_MS })
}

interface HostHooks {
  hostSlots(): Record<string, string>
  hostBridge: { exit(): Promise<void> }
}
type Envelope = { readonly version: number; readonly data: { embers: number; playTicks: number } }

/** The slot as the player's account holds it, once the fake host has synced it (a second after the last write). */
const accountSlot = async (page: Page): Promise<Envelope | undefined> => {
  const value = await page.evaluate(() => (window as unknown as HostHooks).hostSlots()['base-3d'])
  return value === undefined ? undefined : (JSON.parse(value) as Envelope)
}
const SYNC_WAIT = { timeout: 10_000 }

test('boots standalone under Ruken’s headers: the splash, then the menu with New game focused', async ({
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
  await expect(page.getByTestId('save-slots-new')).toBeFocused()
  expect(errors).toEqual([])
})

test('inside the fake host on another origin: the handshake, the menu, play and pause', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, GAME_ID)
  const trace = await page.evaluate(() => (window as unknown as { hostTrace: () => string[] }).hostTrace())
  expect(trace.slice(0, 3)).toEqual(['hello', 'welcome', 'session.ready'])
  await toPlay(frame, 'save-slots-new')
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

// The save round-trip (G3-s, DESIGN.md §12.1). Taking the ember in play is the DOM test's (screens.dom.test.ts):
// the walk to the kiln is hundreds of software-drawn frames here. This journey proves the browser half: a session's
// write reaches the account, and a second session's Continue plays a slot that holds a taken ember and keeps it.
test('a save round-trip: the first session writes the slot, and the next continues it with the ember kept', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  let frame = await openHosted(page, gameUrl, GAME_ID)
  await toPlay(frame, 'save-slots-new')
  await frame.locator('body').press('Escape', { timeout: PLAY_STEP_MS })
  await expect(screen(frame, 'paused')).toBeAttached({ timeout: PLAY_STEP_MS })
  await expect.poll(async () => (await accountSlot(page))?.version, SYNC_WAIT).toBe(1)
  await page.evaluate(() => (window as unknown as HostHooks).hostBridge.exit())
  const first = (await accountSlot(page)) as Envelope
  expect(first.data.embers).toBe(0)

  // The account the next session opens: the first session's slot, as it would be had Wick taken the ember.
  const withEmber = { ...first, data: { ...first.data, embers: 1 } }
  frame = await openHosted(page, gameUrl, GAME_ID, { saves: { 'base-3d': JSON.stringify(withEmber) } })
  await toPlay(frame, 'save-slots-load')
  await frame.locator('body').press('Escape', { timeout: PLAY_STEP_MS })
  await expect(screen(frame, 'paused')).toBeAttached({ timeout: PLAY_STEP_MS })
  await page.evaluate(() => (window as unknown as HostHooks).hostBridge.exit())
  await expect
    .poll(async () => (await accountSlot(page))?.data.playTicks ?? 0, SYNC_WAIT)
    .toBeGreaterThan(first.data.playTicks)
  expect((await accountSlot(page))?.data.embers).toBe(1)
  expect(errors).toEqual([])
})

test('under a host that grants no saves, paused says progress is not kept and the device stores nothing (G3-F4)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, GAME_ID, { grant: [] })
  await toPlay(frame, 'save-slots-new')
  await frame.locator('body').press('Escape', { timeout: PLAY_STEP_MS })
  await expect(screen(frame, 'paused')).toBeAttached({ timeout: PLAY_STEP_MS })
  await expect(frame.locator('[data-save-status]')).toHaveAttribute('data-state', 'no-grant', SYNC_WAIT)
  await expect(frame.locator('[data-save-status]')).toHaveCount(1)
  const stored = await frame.evaluate(async () => ({
    local: localStorage.length,
    databases: (await indexedDB.databases()).length,
  }))
  expect(stored).toEqual({ local: 0, databases: 0 })
  expect(errors).toEqual([])
})
