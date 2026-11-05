import { expect, type Page, test } from '@playwright/test'
import { createBaseSim, moveCommand, readPlayer } from '#src/app/base-sim.ts'
import { GOLDEN_GOAL_TICK, GOLDEN_ROUTE } from '#src/testing/golden.ts'
import { ROOM } from '../../fixtures/hand-written-room.ts'
import { HAND_WRITTEN_TUNING } from '../../fixtures/hand-written-tuning.ts'
import { gameUrl, hostOrigin } from './origins.ts'

// emberwick in a real browser, served from /b/<buildId>/ with the headers Ruken would serve it with
// (vite.config.ts, compileHeaders: no eval). Every journey fails on any console error, CSP violations included.

/**
 * Collects console errors, page errors and CSP violations. A violation does not always reach the console
 * (a blocked fetch or image only fires `securitypolicyviolation`), so a listener installed before the page's
 * own scripts turns each one into a console error.
 */
async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`)
    })
  })
  return errors
}

const game = (page: Page) => page.locator('#game')

/**
 * A phone held sideways and standalone (the compact project) plays fullscreen or not at all (M4.7): the landscape
 * gate covers the game until the player taps its fullscreen button. Elsewhere the gate never shows.
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

async function openMenu(page: Page) {
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await passLandscapeGate(page)
  const current = await game(page).getAttribute('data-screen')
  if (current === 'splash') {
    await page.keyboard.press('KeyX')
  }
  await expect(game(page)).toHaveAttribute('data-screen', 'menu')
}

/**
 * How long one step of a journey may take once the room plays. The room draws every frame, and the headless shell
 * draws WebGL in software: a median of 167 to 233 ms a frame on a quiet machine, up to 3.8 s on a loaded one
 * (measured for CI.N2, docs/archive/superpowers/plans/2026-10-30-ci-n2-touch-journey-ready.md). The loop asks for the next
 * frame as soon as one is drawn, so every Playwright call in the room waits two or three frames for the page (a
 * bounding box about eight; 16 s under that load), and Playwright's 5 s for an assertion is less than two loaded
 * frames. This is ten of the slowest frames measured. It caps any single step in the room; a journey's own test
 * timeout is the limit that binds the journey as a whole.
 */
const ROOM_STEP_MS = 40_000

/**
 * Waits until the room is live: its screen is open (the tap was taken), then a frame has drawn the round's first
 * sim step. `data-player-x` is that step published: the scene has no player until a step of this round reaches
 * it (`AppLoop.run` resets the renderer), and the room attaches its touch buttons and keys before it starts the
 * loop. `data-screen="room"` alone is not enough: the screen is drawn before the round's sim exists.
 */
async function roomLive(page: Page) {
  await expect(game(page)).toHaveAttribute('data-screen', 'room', { timeout: ROOM_STEP_MS })
  await expect(game(page)).toHaveAttribute('data-player-x', /\d+/, { timeout: ROOM_STEP_MS })
}

test('boots standalone under Ruken’s headers and shows the splash, then the menu', async ({ page }) => {
  const errors = await collectErrors(page)
  const response = await page.goto(gameUrl)
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await passLandscapeGate(page)
  await expect(page.locator('canvas')).toBeVisible()
  const initial = await game(page).getAttribute('data-screen')
  if (initial === 'splash') {
    // The splash moves on by itself.
    await expect(game(page)).toHaveAttribute('data-screen', 'menu')
  } else {
    expect(initial).toBe('menu')
  }
  await expect(page.getByRole('button', { name: 'Play' })).toBeFocused()
  expect(errors).toEqual([])
})

test('counts a CSP violation as an error, even one the console never shows', async ({ page }) => {
  const errors = await collectErrors(page)
  await openMenu(page)
  // Ruken's CSP allows images only from the game's own origin, so this one is blocked.
  await page.evaluate(() => {
    const image = new Image()
    image.src = 'https://example.com/blocked.png'
    document.body.append(image)
  })
  await expect.poll(() => errors.some((error) => error.includes('CSP violation: img-src'))).toBe(true)
})

test('a device with no canvas context gets the device message, not a connection one', async ({ page }) => {
  // No 2D, WebGL or WebGPU context: Pixi cannot start, so the runtime's boot ends on its failure panel with the
  // `unsupported` copy (the panel also offers a way out, so the text is contained, not the whole of #game).
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null
    Object.defineProperty(navigator, 'gpu', { value: undefined })
  })
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'failed')
  await expect(game(page)).toContainText("This device can't run the game.")
})

test('menu → room → pause → resume → pause → quit, by keyboard and buttons', async ({ page }) => {
  const errors = await collectErrors(page)
  await openMenu(page)
  await page.keyboard.press('Enter')
  await expect(game(page)).toHaveAttribute('data-screen', 'room')
  await expect(game(page)).toHaveAttribute('data-player-x', /\d+/)
  await page.keyboard.press('Escape')
  await expect(game(page)).toHaveAttribute('data-screen', 'paused')
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(game(page)).toHaveAttribute('data-screen', 'room')
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(game(page)).toHaveAttribute('data-screen', 'paused')
  await page.getByRole('button', { name: 'Quit' }).click()
  await expect(game(page)).toHaveAttribute('data-screen', 'menu')
  expect(errors).toEqual([])
})

test('the character walks and jumps with the keyboard', async ({ page }) => {
  const errors = await collectErrors(page)
  await openMenu(page)
  await page.keyboard.press('Enter')
  await expect(game(page)).toHaveAttribute('data-player-x', /\d+/)
  const x0 = Number(await game(page).getAttribute('data-player-x'))
  const y0 = Number(await game(page).getAttribute('data-player-y'))
  await page.keyboard.down('ArrowRight')
  // Walk out from under the low platform over the start (columns 3 to 10, ending at pixel 88), or the jump
  // hits its underside after four pixels.
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-player-x')))
    .toBeGreaterThan(Math.max(x0 + 16, 92))
  await page.keyboard.up('ArrowRight')
  await page.keyboard.down('KeyZ')
  await expect.poll(async () => Number(await game(page).getAttribute('data-player-y'))).toBeLessThan(y0 - 8)
  await page.keyboard.up('KeyZ')
  expect(errors).toEqual([])
})

// Playwright's clock drives requestAnimationFrame and performance.now, so the golden route can be played with
// real key presses tick for tick. Frames come every 16 ms and steps every 16.67 ms, so a frame runs at most one
// step: the test moves the clock one frame at a time, reads the sim tick the page shows, and changes keys right
// after the frame that ran a segment's last step.
test('playing the golden route with the keyboard reaches the ember and the end screen', {
  tag: '@slow',
}, async ({ page }) => {
  // 342 frames, each drawn by render-pixi at the device's resolution (capped at 2) in the full letterbox. In the
  // headless software renderer that is ~160 ms a frame on the phone project (measured, DX.3 decision E-7), so
  // the route needs more than the default 30 s (1.8 min with four workers). The route and its assertions are
  // unchanged.
  test.setTimeout(300_000)
  const errors = await collectErrors(page)
  await page.clock.install()
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await passLandscapeGate(page)
  await page.keyboard.press('KeyX')
  await expect(game(page)).toHaveAttribute('data-screen', 'menu')
  // Installed, the clock still runs at wall speed; from here on it moves only when the test moves it.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
  await page.keyboard.press('Enter')
  await expect(game(page)).toHaveAttribute('data-screen', 'room')

  const keyFor = { [-1]: 'ArrowLeft', 0: null, 1: 'ArrowRight' } as const
  let held: string[] = []
  const hold = async (wanted: string[]) => {
    for (const key of held) if (!wanted.includes(key)) await page.keyboard.up(key)
    for (const key of wanted) if (!held.includes(key)) await page.keyboard.down(key)
    held = wanted
  }
  const pageTick = async () => Number((await game(page).getAttribute('data-tick')) ?? 0)

  // The same route in a sim in this Node process: after every segment the page's character must be exactly
  // where the sim says, so a mismatch names the segment where the page and the sim parted.
  const reference = await createBaseSim({ room: ROOM, tuning: HAND_WRITTEN_TUNING })
  let ticks = 0
  for (const [index, [x, jump, length]] of GOLDEN_ROUTE.entries()) {
    const direction = keyFor[x]
    await hold([...(direction === null ? [] : [direction]), ...(jump ? ['KeyZ'] : [])])
    ticks = Math.min(ticks + length, GOLDEN_GOAL_TICK)
    while ((await pageTick()) < ticks) await page.clock.runFor(16)
    expect(await pageTick(), `the page ran past segment ${index}`).toBe(ticks)
    while (reference.tick < ticks) reference.step([moveCommand(reference, { x, jump })])
    const expected = readPlayer(reference)
    const actual = {
      x: await game(page).getAttribute('data-player-x'),
      y: await game(page).getAttribute('data-player-y'),
    }
    expect(actual, `after segment ${index} (tick ${ticks})`).toEqual({
      x: String(Math.floor(expected.x / 256)),
      y: String(Math.floor(expected.y / 256)),
    })
    if (ticks === GOLDEN_GOAL_TICK) break
  }
  reference.dispose()
  await hold([])
  await expect(game(page)).toHaveAttribute('data-screen', 'end')
  await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused()
  await expect(page.locator('[data-slot="time"]')).toHaveText('5.70 s')
  expect(errors).toEqual([])
})

test('the touch buttons move the character', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch buttons show on coarse pointers')
  // The whole journey took up to 48 s with the page's CPU throttled 5x and 59 s at 10x (CI.N2), past the default
  // 30 s. This timeout, about twice the slowest pass, binds the journey; ROOM_STEP_MS only caps each of its steps.
  test.setTimeout(120_000)
  const errors = await collectErrors(page)
  await openMenu(page)
  await page.getByRole('button', { name: 'Play' }).tap()
  await roomLive(page)
  const x0 = Number(await game(page).getAttribute('data-player-x'))
  const right = page.locator('[data-hold="right"]')
  await expect(right).toBeVisible({ timeout: ROOM_STEP_MS })
  const box = await right.boundingBox({ timeout: ROOM_STEP_MS })
  if (box === null) throw new Error('no right button')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // About 14 sim steps of walking; a slow frame runs up to 6 of them (the loop's 100 ms clamp).
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-player-x')), { timeout: ROOM_STEP_MS })
    .toBeGreaterThan(x0 + 16)
  await page.mouse.up()
  expect(errors).toEqual([])
})

test('every button of the room and the pause screen is on screen and at least 44 px', async ({ page }) => {
  const errors = await collectErrors(page)
  await openMenu(page)
  await page.keyboard.press('Enter')
  await expect(game(page)).toHaveAttribute('data-screen', 'room')
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('no viewport')
  const check = async (selector: string) => {
    for (const button of await page.locator(selector).all()) {
      if (!(await button.isVisible())) continue
      const box = await button.boundingBox()
      if (box === null) throw new Error(`${selector} has no box`)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }
  }
  await check('.hud button, .touch button')
  await page.keyboard.press('Escape')
  await check('[data-layer="screens"] [data-screen="paused"] button')
  expect(errors).toEqual([])
})

test('completes the Ruken handshake inside a fake host frame on another origin', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto(`${hostOrigin}/`)
  const frame = page.frameLocator('iframe')
  await expect(frame.locator('#game')).toHaveAttribute('data-screen', /splash|menu/)
  expect(page.frames().map((f) => f.url())).toContain(gameUrl)
  const trace = await page.evaluate(() => (window as unknown as { hostTrace: () => string[] }).hostTrace())
  expect(trace.slice(0, 3)).toEqual(['hello', 'welcome', 'session.ready'])
  expect(errors).toEqual([])
})
