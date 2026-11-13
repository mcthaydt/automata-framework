// look-pixel-art under the fake host and Ruken's headers (compileHeaders' CSP), in Chromium (the `examples-3d` project) and
// WebKit (`examples-3d-webkit`). Headless Firefox in this container has no WebGL; the GPU runner covers it.
import { examples3dPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, type Frame, type Page, test } from '@playwright/test'

const gameUrl = `http://localhost:${examples3dPort}/look/pixel-art/`
const ID = 'look-pixel-art'

/** What the game canvas shows, counted in the page right after the game drew it (a canvas is too big to send over). */
interface Seen {
  /** Wick's cloak (blue well over red; nothing else in the scene is) in the left, middle and right third. */
  readonly blue: [number, number, number]
  /** Distinct colours. */
  readonly colours: number
  /** The mean of red, green and blue, 0 to 255. */
  readonly brightness: number
}

/**
 * The count over the canvas as it stands (it runs in the page, so it uses nothing from this file). A WebGL canvas keeps its
 * picture only in the task that drew it unless the context asks to preserve it (`keepDrawing`); with it, the canvas holds
 * the last frame the game drew and any moment is a moment to read it.
 */
const count = (): Seen => {
  const empty: Seen = { blue: [0, 0, 0], colours: 0, brightness: 0 }
  const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
  if (canvas === null) return empty
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d')
  context?.drawImage(canvas, 0, 0)
  const data = context?.getImageData(0, 0, copy.width, copy.height).data
  if (data === undefined) return empty
  const blue: [number, number, number] = [0, 0, 0]
  const colours = new Set<number>()
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
    colours.add((r << 16) | (g << 8) | b)
    total += (r + g + b) / 3
    if (b > 90 && b > r + 50 && b > g + 10)
      blue[Math.min(2, Math.floor((((i / 4) % copy.width) / copy.width) * 3))]++
  }
  return { blue, colours: colours.size, brightness: total / (data.length / 4) }
}

/** Makes every WebGL context keep its drawing buffer, so the canvas can be read between frames. It changes no pixel. */
const keepDrawing = (): void => {
  const getContext = HTMLCanvasElement.prototype.getContext as (
    this: HTMLCanvasElement,
    ...args: unknown[]
  ) => unknown
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    attributes?: object,
  ) {
    return getContext.call(
      this,
      type,
      type.startsWith('webgl') ? { ...attributes, preserveDrawingBuffer: true } : attributes,
    )
  } as typeof HTMLCanvasElement.prototype.getContext
}

const seen = (frame: Frame): Promise<Seen> => frame.evaluate(count)

/** The sim tick the page last drew (the example sets it on the page for this journey). */
const tickOf = (frame: Frame): Promise<number> =>
  frame.evaluate(() => Number(document.documentElement.dataset.tick))

/**
 * The tick the picture is read at. Wick walks a 660-tick loop and stands for the last 180 (the walk system), at the loop's
 * start; at 600 Wick has stood for 120 of them, and the camera, which eases on the frame clock, has settled on Wick there.
 * Read while Wick walked or the camera moved, the brightness drifted by a tenth of its value with the moment it was read at.
 */
const HOLD_TICK = 600

/** Where the faked clock (which starts at 0) is paused: far past any run, so the pause is always ahead of it. */
const PAUSE_AT = 10 * 60_000

/**
 * Holds the game at `HOLD_TICK`, with its clock in the test's hands, and reads the frame drawn at that tick. The clock is
 * paused, then run in frames until the page says the tick, so the frame is
 * the game's at a tick and not at a moment: no machine speed and no load changes it. Time before the pause only brings
 * the game to a tick below `HOLD_TICK`.
 */
async function heldAt(page: Page, frame: Frame): Promise<Seen> {
  await page.clock.pauseAt(PAUSE_AT)
  expect(
    await tickOf(frame),
    'the game ran past the held tick before its clock was paused',
  ).toBeLessThanOrEqual(HOLD_TICK)
  // A frame of 100 ms is the longest the game takes (six ticks at most, the loop clamps it) and costs one drawn frame, so it
  // brings the tick near; a frame of 16 ms is 0 or 1 tick, so the last few cannot overshoot.
  const left = async () => HOLD_TICK - (await tickOf(frame))
  while ((await left()) > 6) await page.clock.fastForward(100)
  while ((await left()) > 0) await page.clock.runFor(16)
  expect(await tickOf(frame)).toBe(HOLD_TICK)
  // The last step's frame is drawn by the time the clock call returns, and the canvas keeps it.
  return seen(frame)
}

test('draws the pixel-art look under the CSP: few colours, in hard-edged blocks', async ({ page }) => {
  const errors = await collectErrors(page)
  // A WebGL feedback loop is logged as a warning, which `collectErrors` does not see, so it is read here.
  const loops: string[] = []
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type()) && /feedback loop/i.test(message.text()))
      loops.push(message.text())
  })
  // The page's clock is faked from the start; it runs by itself, as the real one does, until the picture is held.
  await page.clock.install({ time: 0 })
  await page.addInitScript(keepDrawing)
  const frame = await openHosted(page, gameUrl, ID)
  await expect(frame.locator('canvas.af-stage')).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // The colours snap to the DUEL palette (32 ramps of 8) and the look draws hard-edged blocks: a smooth 3D render of
  // this scene holds thousands of distinct colours.
  await expect.poll(async () => (await seen(frame)).colours, { timeout: 15_000 }).toBeGreaterThan(3)
  const held = await heldAt(page, frame)
  expect(held.colours).toBeLessThanOrEqual(256)
  // The fog starts at the camera's distance, so the floor and Wick draw in their own colours and not in the fog's. Held at
  // `HOLD_TICK` the frame reads 40.35 (three runs: 40.3505, 40.3494, 40.3505) and, with the fog back at 5 to 14 m under the
  // camera 16 m away, 19.61 (three runs, Wick's blue at 0); the floor is the one between. The bar was 40, set on a frame read
  // at whatever moment it was and through the day veil that the haze's focus fix removed, so 40 was the veil's, not the scene's.
  expect(held.brightness).toBeGreaterThan(30)
  expect(loops).toEqual([])
  expect(errors).toEqual([])
})
