import { expect, type Page, test } from '@playwright/test'
import { createBaseSim, moveCommand, readPlayer } from '../src/base-sim.ts'
import { GOLDEN_GOAL_TICK, GOLDEN_ROUTE } from '../src/golden.ts'
import { gameUrl, hostOrigin } from './origins.ts'

// base-2d in a real browser, served from /b/<buildId>/ with the headers Ruken would serve it with
// (vite.config.ts, compileHeaders: no eval). Every journey fails on any console error, CSP violations included.

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

const game = (page: Page) => page.locator('#game')

async function openMenu(page: Page) {
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await expect(game(page)).toHaveAttribute('data-screen', 'splash')
  await page.keyboard.press('KeyX')
  await expect(game(page)).toHaveAttribute('data-screen', 'menu')
}

test('boots standalone under Ruken’s headers and shows the splash, then the menu', async ({ page }) => {
  const errors = collectErrors(page)
  const response = await page.goto(gameUrl)
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(game(page)).toHaveAttribute('data-screen', 'splash')
  // The splash moves on by itself.
  await expect(game(page)).toHaveAttribute('data-screen', 'menu')
  await expect(page.getByRole('button', { name: 'Play' })).toBeFocused()
  expect(errors).toEqual([])
})

test('menu → room → pause → resume → pause → quit, by keyboard and buttons', async ({ page }) => {
  const errors = collectErrors(page)
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
  const errors = collectErrors(page)
  await openMenu(page)
  await page.keyboard.press('Enter')
  await expect(game(page)).toHaveAttribute('data-player-x', /\d+/)
  const x0 = Number(await game(page).getAttribute('data-player-x'))
  const y0 = Number(await game(page).getAttribute('data-player-y'))
  await page.keyboard.down('ArrowRight')
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-player-x')))
    .toBeGreaterThan(x0 + 16)
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
test('playing the golden route with the keyboard reaches the bubble and the end screen', async ({ page }) => {
  const errors = collectErrors(page)
  await page.clock.install()
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
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
  const reference = await createBaseSim()
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
  const errors = collectErrors(page)
  await openMenu(page)
  await page.getByRole('button', { name: 'Play' }).tap()
  await expect(game(page)).toHaveAttribute('data-player-x', /\d+/)
  const x0 = Number(await game(page).getAttribute('data-player-x'))
  const right = page.locator('[data-hold="right"]')
  await expect(right).toBeVisible()
  const box = await right.boundingBox()
  if (box === null) throw new Error('no right button')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-player-x')))
    .toBeGreaterThan(x0 + 16)
  await page.mouse.up()
  expect(errors).toEqual([])
})

test('every button of the room and the pause screen is on screen and at least 44 px', async ({ page }) => {
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
  await check('[data-for="paused"] button')
})

test('completes the Ruken handshake inside a fake host frame on another origin', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(`${hostOrigin}/`)
  const frame = page.frameLocator('iframe')
  await expect(frame.locator('#game')).toHaveAttribute('data-screen', /splash|menu/)
  expect(page.frames().map((f) => f.url())).toContain(gameUrl)
  const trace = await page.evaluate(() => (window as unknown as { hostTrace: () => string[] }).hostTrace())
  expect(trace.slice(0, 3)).toEqual(['hello', 'welcome', 'session.ready'])
  expect(errors).toEqual([])
})
