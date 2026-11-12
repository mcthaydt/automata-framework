import { expect, type Page, test } from '@playwright/test'
import { begin, stateOf, waitFor } from './driver.ts'

// The camera turns horizontally, as an ordinary third-person game's does, by each of the three ways the Owner named (2026-11-12:
// "Also cut the Q and E, let it be rotate horizontally with right stick, screen swipe, and mouse like normal 3D, but lock
// vertical rotation"): a mouse drag (either button), a finger's swipe on the scene, and a pad's right stick. Q and E do nothing.
// Each turn is read from the sim's own heading through the probe, so the journey waits on state, never on a sleep.

/** A whole turn in the sim's units. */
const TURN = 65_536
/** The signed turn from `a` to `b`, in (−TURN/2, TURN/2]. */
const turned = (a: number, b: number): number => ((((b - a) % TURN) + TURN + TURN / 2) % TURN) - TURN / 2

async function headingOf(page: Page): Promise<number> {
  const heading = (await stateOf(page)).heading
  if (heading === undefined) throw new Error('no heading: is Ada in play?')
  return heading
}

/** Lets the sim take `ticks` more steps, so what was sent has been answered. */
async function settle(page: Page, ticks = 6): Promise<void> {
  await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + ticks }, 120_000)
}

// A stand-in pad whose axes the test sets: the page reads `navigator.getGamepads()` each tick, as it does a real pad's.
const FAKE_PAD = () => {
  const pad = {
    index: 0,
    id: 'journey pad (STANDARD GAMEPAD)',
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  }
  ;(globalThis as unknown as { __pad: typeof pad }).__pad = pad
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true })
}

test.describe('turning the camera', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FAKE_PAD)
    await begin(page)
    await page.evaluate(() => globalThis.__lastLight?.skip())
    await waitFor(page, { cutscene: null }, 600_000)
    await settle(page, 30)
  })

  test('Q and E turn nothing', async ({ page }) => {
    const before = await headingOf(page)
    for (const key of ['KeyQ', 'KeyE']) {
      await page.keyboard.down(key)
      await settle(page, 20)
      await page.keyboard.up(key)
    }
    await settle(page)
    expect(await headingOf(page)).toBe(before)
  })

  test('a mouse drag turns it, with the left button and with the right, and the room follows the mouse', async ({
    page,
  }) => {
    const { width, height } = page.viewportSize() ?? { width: 844, height: 390 }
    const y = Math.round(height * 0.35)
    for (const button of ['left', 'right'] as const) {
      const before = await headingOf(page)
      await page.mouse.move(width * 0.45, y)
      await page.mouse.down({ button })
      await page.mouse.move(width * 0.6, y, { steps: 6 })
      await page.mouse.up({ button })
      await settle(page)
      // Dragged right: the room turns right with the mouse, a positive turn.
      expect(turned(before, await headingOf(page)), `${button} button`).toBeGreaterThan(0)
    }
    // No context menu was left open by the right-button drag: the play screen is still what is on top.
    await expect(page.getByTestId('pause')).toBeVisible()
  })

  test('a finger’s swipe on the scene turns it, and does not walk Ada', async ({ page }) => {
    const { width, height } = page.viewportSize() ?? { width: 844, height: 390 }
    const before = await headingOf(page)
    const at = (await stateOf(page)).ada
    const cdp = await page.context().newCDPSession(page)
    const y = Math.round(height * 0.3)
    const x0 = Math.round(width * 0.7)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
    for (let step = 1; step <= 6; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x0 - step * 15, y }],
      })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await settle(page)
    // Swiped left: the room turns left with the finger, a negative turn.
    expect(turned(before, await headingOf(page))).toBeLessThan(0)
    expect((await stateOf(page)).ada).toEqual(at)
  })

  test('the right stick turns it smoothly, only by its x: the vertical is locked', async ({ page }) => {
    const set = (axes: number[]) =>
      page.evaluate((next) => {
        ;(globalThis as unknown as { __pad: { axes: number[] } }).__pad.axes = next
      }, axes)
    const before = await headingOf(page)
    // Up and down on the right stick: nothing turns, nothing tilts (the tilt is the view's, never the player's).
    await set([0, 0, 0, 1])
    await settle(page, 20)
    await set([0, 0, 0, -1])
    await settle(page, 20)
    await set([0, 0, 0, 0])
    await settle(page)
    expect(await headingOf(page)).toBe(before)
    // Pushed right: the view looks right, which is a negative turn, a little every tick (not one 45° step). How many ticks
    // pass between two reads depends on the renderer's speed, so the journey checks the size of a tick's turn, not a count.
    await set([0, 0, 1, 0])
    // The first heading that differs, read every animation frame so it is a few ticks in.
    const firstChange = (from: number) =>
      page
        .waitForFunction(
          (was) => {
            const now = globalThis.__lastLight?.state()?.heading
            return now !== undefined && now !== was ? now : false
          },
          from,
          { polling: 'raf', timeout: 120_000 },
        )
        .then((handle) => handle.jsonValue() as Promise<number>)
    const early = turned(before, await firstChange(before))
    const later = turned(before, await firstChange((((before + early) % TURN) + TURN) % TURN))
    await set([0, 0, 0, 0])
    expect(early).toBeLessThan(0)
    // Analogue: a whole number of ticks at the stick's rate (455 units, 2.5 degrees a tick), never a 45-degree step's 8,192,
    // and it keeps turning while the stick is held.
    expect(Math.abs(early) % 455).toBe(0)
    expect(Math.abs(early)).toBeLessThan(8_192)
    expect(later).toBeLessThan(early)
  })
})
