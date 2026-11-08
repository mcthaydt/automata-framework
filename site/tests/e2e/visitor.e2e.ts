import { devices, expect, type FrameLocator, type Locator, type Page, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'

// A visitor's first visit, end to end on the built site: they land on Home and play Emberwick in the page, go to
// Start and copy the command that makes a game, open the Editor page and try the editor, make a platformer level,
// paint on it, and share it. Once on a desktop and once on an upright phone (the demo plays
// upright there). Every step is found the way a visitor finds it: by its role and its words.

const ORIGIN = `http://127.0.0.1:${SITE_PORT}`
const CREATE_COMMAND = 'npx @automata/tools create-game my-game'

/**
 * The room draws every frame and the headless shell draws WebGL in software, so one step inside the game can take
 * many seconds on a loaded machine (Emberwick's own journeys measured up to 3.8 s a frame). This caps one step.
 */
const GAME_STEP_MS = 40_000

/** The game's root element, inside the demo's frame. */
const game = (demo: FrameLocator): Locator => demo.locator('#game')

/** Plays the demo from its poster until the player stands in the room, then moves them right and sees them move. */
async function playEmberwick(page: Page, input: 'keyboard' | 'touch'): Promise<void> {
  // One press, right after the page's first byte: Home is prerendered, so its Play is there before the script that
  // answers it, and the press must still count (the visitor does not press twice).
  await page.getByRole('button', { name: 'Play it' }).click({ timeout: GAME_STEP_MS })
  await expect(page.locator('iframe[title="Emberwick"]')).toBeAttached({ timeout: GAME_STEP_MS })
  const demo = page.frameLocator('iframe[title="Emberwick"]')
  await expect(demo.locator('html')).toHaveAttribute('data-state', 'ready', { timeout: GAME_STEP_MS })
  // The splash moves on by itself or on any key; the menu's Play starts the room.
  await expect(game(demo)).toHaveAttribute('data-screen', /splash|menu/, { timeout: GAME_STEP_MS })
  if ((await game(demo).getAttribute('data-screen')) === 'splash') await page.keyboard.press('KeyX')
  await demo.getByRole('button', { name: 'Play' }).click({ timeout: GAME_STEP_MS })
  await expect(game(demo)).toHaveAttribute('data-player-x', /\d+/, { timeout: GAME_STEP_MS })
  if (input === 'touch') {
    // Upright: the frame is taller than wide, so the game plays in it rather than asking to be turned or fullscreened.
    const frame = await page.locator('iframe[title="Emberwick"]').boundingBox()
    expect(frame !== null && frame.height > frame.width, 'the demo stands upright on an upright phone').toBe(
      true,
    )
  }
  const startX = Number(await game(demo).getAttribute('data-player-x'))

  if (input === 'keyboard') {
    await page.keyboard.down('ArrowRight')
  } else {
    // The on-screen pad shows on a touch screen; its buttons are hidden from assistive tech (the keys do the same), so
    // they are found as the game's own journey finds them. Held, as a thumb holds it.
    const right = demo.locator('[data-hold="right"]')
    await expect(right).toBeVisible({ timeout: GAME_STEP_MS })
    await right.scrollIntoViewIfNeeded({ timeout: GAME_STEP_MS })
    const box = await right.boundingBox({ timeout: GAME_STEP_MS })
    if (box === null) throw new Error('the demo has no right button')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
  }
  await expect
    .poll(async () => Number(await game(demo).getAttribute('data-player-x')), { timeout: GAME_STEP_MS })
    .toBeGreaterThan(startX)
  if (input === 'keyboard') await page.keyboard.up('ArrowRight')
  else await page.mouse.up()
}

/** Home's headline, Start's four steps, and the first command: copied with its button, it is what the clipboard holds. */
async function copyTheCommand(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Make browser games with your coding agent.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Make a game' }).first().click()
  await expect(page).toHaveURL(/\/start\/?$/)
  for (const step of ['1. Make a game', '2. Play it', '3. Draw its level', '4. Put it online'])
    await expect(page.getByRole('heading', { name: step })).toBeVisible()
  const first = page.getByRole('listitem').filter({ hasText: CREATE_COMMAND })
  await first.getByRole('button', { name: 'Copy command' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CREATE_COMMAND)
}

/** The Editor page, Try the editor, a platformer level and one painted cell: Download hands over the level. */
async function drawAndShareALevel(page: Page): Promise<void> {
  await page.goto('/editor')
  await page.getByRole('link', { name: 'Try the editor' }).click()
  await expect(page).toHaveURL(/\/editor\/app\/$/)
  await page.getByRole('button', { name: 'New level' }).click()
  await page.getByRole('button', { name: /Platformer/ }).click()

  const canvas = page.locator('[data-level-canvas]')
  await expect(canvas).toHaveAttribute('data-state', 'drawn')
  // On a phone the layers are a sheet over the canvas: the top bar's Panel opens it to choose, and Escape closes it to paint.
  const layer = page.getByRole('button', { name: 'Collision Walls and floors' })
  const sheet = !(await layer.isVisible())
  if (sheet) await page.getByRole('button', { name: 'Panel' }).click()
  await layer.click()
  // The sheet stays up for choosing what to paint with; Escape puts it away.
  if (sheet) await page.keyboard.press('Escape')
  await page.getByRole('radio', { name: 'Brush' }).click()
  await expect(canvas).toHaveAttribute('data-state', 'drawn')
  const before = await canvasPicture(page, canvas)
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('the level canvas is not on the page')
  // The canvas publishes its camera as `data-camera="x,y,scale"`: level pixel p is drawn at x + p * scale. Cell (16, 4)
  // of the platformer's 16-pixel grid is open air, so a painted wall changes it.
  const [cx = 0, cy = 0, scale = 1] = ((await canvas.getAttribute('data-camera')) ?? '')
    .split(',')
    .map(Number)
  await page.mouse.click(box.x + cx + 16.5 * 16 * scale, box.y + cy + 4.5 * 16 * scale)
  const painted = await canvasPicture(page, canvas)
  expect(painted.equals(before), 'the brush changed the level').toBe(false)
  // The sample keeps nothing, so Share is how the painted level leaves.
  await page.getByRole('button', { name: 'Share' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('untitled-platformer.af2d.json')
  await expect(page.getByText('Downloaded your level.')).toBeVisible()
}

/**
 * What the level canvas shows, once it has drawn and with the pointer off it (a hovered cell is highlighted). The
 * canvas fits the level to its box, so the same level in the same box draws the same picture.
 */
async function canvasPicture(page: Page, canvas: Locator): Promise<Buffer> {
  await page.mouse.move(0, 0)
  await expect(canvas).toHaveAttribute('data-state', 'drawn')
  // The buttons over the canvas are the page's, not the level's, and a
  // focus ring or a hover edge on one would read as a change: they are masked out.
  return canvas.screenshot({ animations: 'disabled', mask: [page.getByRole('button')] })
}

test.describe('a visitor on a desktop', () => {
  test('plays Emberwick, copies the command, and draws a level and shares it', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'reading the clipboard back needs Chromium’s clipboard-read permission',
    )
    test.setTimeout(4 * GAME_STEP_MS)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN })
    const watch = watchPage(page, ORIGIN)
    await page.goto('/', { waitUntil: 'commit' })
    await playEmberwick(page, 'keyboard')
    await copyTheCommand(page)
    await drawAndShareALevel(page)
    expect(watch.problems).toEqual([])
  })
})

test.describe('a visitor on an upright phone', () => {
  const { defaultBrowserType: _browser, ...phone } = devices['iPhone 13']
  test.use(phone)

  test('plays Emberwick upright, copies the command, and draws a level and shares it', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'reading the clipboard back needs Chromium’s clipboard-read permission',
    )
    test.setTimeout(4 * GAME_STEP_MS)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN })
    const watch = watchPage(page, ORIGIN)
    await page.goto('/', { waitUntil: 'commit' })
    await playEmberwick(page, 'touch')
    await copyTheCommand(page)
    await drawAndShareALevel(page)
    expect(watch.problems).toEqual([])
  })
})

test.describe("Home's demo", () => {
  test('one press of Play it before hydration starts Emberwick', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Play it' }).click({ timeout: GAME_STEP_MS })
    await expect(page.locator('iframe[title="Emberwick"]')).toBeAttached({ timeout: GAME_STEP_MS })
    await expect(page.frameLocator('iframe[title="Emberwick"]').locator('html')).toHaveAttribute(
      'data-state',
      'ready',
      {
        timeout: GAME_STEP_MS,
      },
    )
  })

  test('playing, the bar has Full screen and Stop; Stop returns to the poster', async ({ page }) => {
    await page.goto('/')
    const bar = page.locator('.demo-bar')
    await expect(bar.getByRole('button')).toHaveText(['Play it'])
    await bar.getByRole('button', { name: 'Play it' }).click()
    await expect(bar.getByRole('button')).toHaveText(['Full screen', 'Stop'])
    await bar.getByRole('button', { name: 'Stop' }).click()
    await expect(page.locator('iframe[title="Emberwick"]')).toHaveCount(0)
    await expect(page.locator('img.demo-poster')).toBeVisible()
    await expect(bar.getByRole('button')).toHaveText(['Play it'])
  })

  test('Try again after a failure starts the game again', async ({ page }) => {
    let frameLoads = 0
    await page.route('**/demos/emberwick/index.html', async (route) => {
      frameLoads++
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html data-state="failed"><body>boot failed</body></html>',
      })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Play it' }).click()
    await expect(page.getByRole('alert')).toHaveText("Emberwick didn't start.")
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect.poll(() => frameLoads).toBe(2)
  })

  test('at 390 × 844 the picture is the first thing under the hero', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const boxes = await page.evaluate(() => {
      const top = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top ?? -1
      return { hero: top('.intro-text'), picture: top('.demo-viewport'), bar: top('.demo-bar') }
    })
    expect(boxes.picture).toBeGreaterThan(boxes.hero)
    expect(boxes.bar, 'no bar above the picture').toBeGreaterThan(boxes.picture)
  })
})
