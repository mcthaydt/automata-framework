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
type Envelope = { readonly version: number; readonly data: { taken: number[]; playTicks: number } }

/** The slot as the player's account holds it, once the fake host has synced it (a second after the last write). */
const accountSlot = async (page: Page): Promise<Envelope | undefined> => {
  const value = await page.evaluate(() => (window as unknown as HostHooks).hostSlots()['base-3d-free'])
  return value === undefined ? undefined : (JSON.parse(value) as Envelope)
}
const SYNC_WAIT = { timeout: 10_000 }

/** The sim tick the page last drew (main.ts sets it on the root element each step). */
const pageTick = async (frame: Frame) => Number((await frame.locator('html').getAttribute('data-tick')) ?? -1)
/** Waits `count` animation frames in `frame`: long enough for a running loop to step. */
const frames = (frame: Frame, count: number) =>
  frame.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const next = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => next(left - 1)))
        next(n)
      }),
    count,
  )

/**
 * The boot budget for compiling the areas (G3-u, DESIGN.md §13 boot step 3), in milliseconds: the first run measured
 * it (the plan's log records the number), and later runs must stay under it. Held loose for the software-drawn,
 * shared-CPU browsers the journeys run in.
 */
const AREAS_COMPILE_BUDGET_MS = 20

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

// G3-u's cost: compiling the areas at boot is measured (main.ts's `base-3d:compile-areas`) and held under the budget.
test('compiles the areas at boot within the budget, with no console error or CSP violation (G3-u)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, GAME_ID)
  await expect(screen(frame, 'title')).toBeAttached()
  const measured = await frame.evaluate(() =>
    performance.getEntriesByName('base-3d:compile-areas').map((entry) => entry.duration),
  )
  expect(measured).toHaveLength(1)
  console.log(`base-3d: compiling the areas took ${measured[0]?.toFixed(2)} ms`)
  expect(measured[0]).toBeLessThan(AREAS_COMPILE_BUDGET_MS)
  expect(errors).toEqual([])
})

// G3-x: in portrait the rotate cover shows and the sim does not step; turned back, play goes on from the same tick
// with the focus where it was.
test('in portrait, covers play with the rotate hint and holds the sim; turned back, it resumes (G3-x)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, GAME_ID)
  await toPlay(frame, 'save-slots-new')
  await expect.poll(() => pageTick(frame), { timeout: PLAY_STEP_MS }).toBeGreaterThan(0)
  const focused = () => frame.evaluate(() => document.activeElement?.outerHTML.slice(0, 120) ?? '')
  const focusBefore = await focused()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(frame.getByTestId('rotate-hint')).toBeVisible({ timeout: PLAY_STEP_MS })
  const held = await pageTick(frame)
  await frames(frame, 30)
  expect(await pageTick(frame)).toBe(held)
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(frame.getByTestId('rotate-hint')).toHaveCount(0, { timeout: PLAY_STEP_MS })
  await expect(screen(frame, 'play')).toBeAttached()
  await expect.poll(() => pageTick(frame), { timeout: PLAY_STEP_MS }).toBeGreaterThan(held)
  expect(await focused()).toBe(focusBefore)
  expect(errors).toEqual([])
})

// The save round-trip (G3-s, DESIGN.md §12.1). Taking the goal in play is the DOM test's (screens.dom.test.ts):
// the walk across the room is hundreds of software-drawn frames here. This journey proves the browser half: a session's
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
  expect(first.data.taken).toEqual([])

  // The account the next session opens: the first session's slot, as it would be had Wick taken the ember.
  const withEmber = { ...first, data: { ...first.data, taken: [0] } }
  frame = await openHosted(page, gameUrl, GAME_ID, { saves: { 'base-3d-free': JSON.stringify(withEmber) } })
  await toPlay(frame, 'save-slots-load')
  await frame.locator('body').press('Escape', { timeout: PLAY_STEP_MS })
  await expect(screen(frame, 'paused')).toBeAttached({ timeout: PLAY_STEP_MS })
  await page.evaluate(() => (window as unknown as HostHooks).hostBridge.exit())
  await expect
    .poll(async () => (await accountSlot(page))?.data.playTicks ?? 0, SYNC_WAIT)
    .toBeGreaterThan(first.data.playTicks)
  expect((await accountSlot(page))?.data.taken).toEqual([0])
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
