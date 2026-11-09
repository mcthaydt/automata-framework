import { expect, type Page, test } from '@playwright/test'
import { collectErrors } from '../../../tooling/examples-runner/host/testing.ts'
import { gameUrl } from './origin.ts'

// base-3d played with a finger (G2): the stick walks Wick, Roll lunges him, an ember is taken and the HUD counts it, and
// the goal ember ends the game. The journeys build starts Wick beside what is checked (`?route=`, src/testing/route.ts)
// and writes his place on the page, so each step is a few frames of the software-drawn game, not a walk across the room.
// A phone held upright covers play with the rotate hint (base-3d.e2e.ts), so the sizes here are landscape: a phone
// sideways and an iPad.

/** One step may take this long once play draws: the headless shell draws WebGL2 in software. */
const PLAY_STEP_MS = 40_000
const SIZES = [
  { name: 'a phone held sideways', width: 844, height: 390 },
  { name: 'an iPad held sideways', width: 1194, height: 834 },
] as const

// Each journey waits on software-drawn frames in several places.
test.setTimeout(150_000)

/**
 * A phone held sideways and standalone plays fullscreen or not at all: a gate covers the game until the player taps its
 * fullscreen button (base-3d.e2e.ts). On a bigger screen there is none.
 */
async function passLandscapeGate(page: Page) {
  const gate = page.getByTestId('landscape-gate-fullscreen')
  if ((await gate.count()) === 0) return
  await gate.tap()
  await expect(page.getByTestId('landscape-gate')).toHaveCount(0)
}

type Place = { x: number; z: number }
/** Wick's place in metres, as the page writes it after each step. */
const wick = async (page: Page): Promise<Place> => {
  const text = await page.locator('html').getAttribute('data-hero')
  const [x, z] = (text ?? '0,0').split(',').map(Number)
  return { x: x ?? 0, z: z ?? 0 }
}

/** Pushes the stick fully up (the way the camera faces) until `done`, then lets go. */
async function pushStickUp(page: Page, done: () => Promise<boolean>) {
  const box = await page.locator('[data-touch-stick]').boundingBox()
  if (box === null) throw new Error('the touch stick is not on screen')
  const centre = { x: box.x + box.width / 2, z: box.y + box.height / 2 }
  const touch = await page.context().newCDPSession(page)
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centre.x, y: centre.z, id: 1 }],
  })
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: centre.x, y: centre.z - box.height, id: 1 }],
  })
  await expect.poll(done, { timeout: PLAY_STEP_MS }).toBe(true)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await touch.detach()
}

/**
 * Holds a touch button for a moment, as a thumb does: the sim finds a press by comparing ticks, so a tap that comes and
 * goes between two of them (Playwright's tap does) is never seen.
 */
async function holdButton(page: Page, name: string) {
  const box = await page.getByRole('button', { name }).boundingBox()
  if (box === null) throw new Error(`no ${name} button on screen`)
  const at = [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 }]
  const touch = await page.context().newCDPSession(page)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at })
  await page.waitForTimeout(400)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await touch.detach()
}

/** From the splash to play on a finger: the first touch tells the game this is a touch device, which shows the stick. */
async function toPlayByTouch(page: Page, route: string) {
  await page.goto(`${gameUrl}?route=${route}`)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await passLandscapeGate(page)
  await page.locator('body').press('KeyX')
  await page.getByTestId('save-slots-new').tap()
  await expect(page.locator('[data-layer="screens"] [data-screen="play"]')).toBeAttached({
    timeout: PLAY_STEP_MS,
  })
  await expect(page.locator('[data-touch-stick]')).toBeVisible({ timeout: PLAY_STEP_MS })
}

for (const size of SIZES)
  test.describe(`on ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    test('the stick walks Wick, an ember is taken and the HUD counts it', async ({ page }) => {
      const errors = await collectErrors(page)
      await toPlayByTouch(page, 'ember')
      await expect(page.getByTestId('hud-embers')).toHaveText('Embers 0 of 6', { timeout: PLAY_STEP_MS })
      const start = await wick(page)
      await pushStickUp(
        page,
        async () => (await page.getByTestId('hud-embers').textContent())?.includes('Embers 1 of 6') === true,
      )
      expect((await wick(page)).z).toBeGreaterThan(start.z + 0.5)
      expect(errors).toEqual([])
    })

    test('Roll lunges Wick about three metres', async ({ page }) => {
      const errors = await collectErrors(page)
      await toPlayByTouch(page, 'ember')
      await expect.poll(async () => (await wick(page)).z, { timeout: PLAY_STEP_MS }).toBeGreaterThan(0)
      const before = await wick(page)
      await holdButton(page, 'Roll')
      await expect
        .poll(async () => Math.hypot((await wick(page)).x - before.x, (await wick(page)).z - before.z), {
          timeout: PLAY_STEP_MS,
        })
        .toBeGreaterThan(2.5)
      expect(errors).toEqual([])
    })

    test('the goal ember ends the game', async ({ page }) => {
      const errors = await collectErrors(page)
      await toPlayByTouch(page, 'goal')
      await pushStickUp(
        page,
        async () => (await page.locator('[data-layer="screens"] [data-screen="end"]').count()) > 0,
      )
      await expect(page.getByTestId('end-screen')).toBeVisible()
      expect(errors).toEqual([])
    })
  })
