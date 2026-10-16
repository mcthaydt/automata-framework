import { expect, type Page, test } from '@playwright/test'
import { playGoldenRoute } from './golden-route.ts'
import { gameUrl, hostOrigin } from './origins.ts'

// base-2d in a real browser, served from /b/<buildId>/ with the headers Ruken would serve it with
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

async function openMenu(page: Page) {
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  const current = await game(page).getAttribute('data-screen')
  if (current === 'splash') {
    await page.keyboard.press('KeyX')
  }
  await expect(game(page)).toHaveAttribute('data-screen', 'menu')
}

test('boots standalone under Ruken’s headers and shows the splash, then the menu', async ({ page }) => {
  const errors = await collectErrors(page)
  const response = await page.goto(gameUrl)
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
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
  // No 2D, WebGL or WebGPU context: Pixi cannot start, so the boot ends with RendererFailed (boot-page.ts).
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null
    Object.defineProperty(navigator, 'gpu', { value: undefined })
  })
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'failed')
  await expect(game(page)).toHaveText("This device can't run the game.")
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
// real key presses tick for tick (golden-route.ts).
test('playing the golden route with the keyboard reaches the ember and the end screen', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.clock.install()
  await page.goto(gameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await page.keyboard.press('KeyX')
  await expect(game(page)).toHaveAttribute('data-screen', 'menu')
  // Installed, the clock still runs at wall speed; from here on it moves only when the test moves it.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
  await page.keyboard.press('Enter')
  await expect(game(page)).toHaveAttribute('data-screen', 'room')

  const { expectedHash } = await playGoldenRoute(page, game(page))
  await expect(game(page)).toHaveAttribute('data-screen', 'end')
  await expect(game(page)).toHaveAttribute('data-hash', expectedHash)
  await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused()
  await expect(page.locator('[data-slot="time"]')).toHaveText('5.70 s')
  expect(errors).toEqual([])
})

test('the touch buttons move the character', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch buttons show on coarse pointers')
  const errors = await collectErrors(page)
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
  await check('[data-for="paused"] button')
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
