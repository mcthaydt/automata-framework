import { expect, type Page, test } from '@playwright/test'
import type { LookState } from '#src/app/look-passes.ts'
import { begin, stateOf, waitFor } from './driver.ts'

// The old game's picture: its LCD panel and its retro grade are on in the opening cutscene and in play, and the grade's film (grain,
// dust, scratch) holds still for a player whose system asks for less motion. It reads the passes the renderer made through the
// development build's hook, and waits on the game's own state, never on a sleep.

// The hook's declared type (`LookState` in `look-passes.ts`, whose `declare global` types `globalThis.__lastLightLook`), not `any`.
const looks = (page: Page): Promise<LookState | undefined> =>
  page.evaluate(() => globalThis.__lastLightLook?.())

test('the LCD panel and the retro grade are on in the opening and in play', async ({ page }) => {
  await begin(page)
  await page.getByTestId('cutscene-caption').waitFor({ state: 'visible', timeout: 120_000 })
  const cutscene = await looks(page)
  expect(cutscene?.retro).toHaveLength(1)
  expect(cutscene?.lcd).toHaveLength(1)
  expect(cutscene?.retro[0]?.enabled).toBe(true)
  expect(cutscene?.lcd[0]?.enabled).toBe(true)
  await waitFor(page, { cutscene: null }, 600_000)
  const play = await looks(page)
  expect(play?.retro[0]?.enabled).toBe(true)
  expect(play?.lcd[0]?.enabled).toBe(true)
  // The film moves while motion is allowed.
  await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 60 })
  expect(((await looks(page))?.retro[0]?.clock ?? 0) > (play?.retro[0]?.clock ?? 0)).toBe(true)
})

test.describe('with less motion asked for', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the film holds still', async ({ page }) => {
    await begin(page)
    await page.getByTestId('cutscene-caption').waitFor({ state: 'visible', timeout: 120_000 })
    const before = await looks(page)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 60 })
    const after = await looks(page)
    expect(before?.retro[0]?.enabled).toBe(true)
    expect(after?.retro[0]?.clock).toBe(before?.retro[0]?.clock)
  })
})

// The bars round the picture are black, as the old game's page was. A window that is not a whole multiple of the field leaves bars
// (here 1024 by 768 made 640 by 480 after the game started, so the 512 by 384 field sits in a taller view); a pixel in one is read
// from the page's own screenshot, decoded by the browser.
test.describe('the bars', () => {
  test.use({ hasTouch: false, isMobile: false, deviceScaleFactor: 1 })

  const pixelOf = async (page: import('@playwright/test').Page, x: number, y: number) => {
    const png = (await page.screenshot()).toString('base64')
    return page.evaluate(
      async ([data, at]) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob())
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
        context.drawImage(bitmap, 0, 0)
        const [r, g, b] = context.getImageData(at[0] as number, at[1] as number, 1, 1).data
        return [r, g, b]
      },
      [png, [x, y]] as const,
    )
  }

  test('are black in a cutscene and in play, and the page behind them is black', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await begin(page)
    await page.getByTestId('cutscene-caption').waitFor({ state: 'visible', timeout: 120_000 })
    await page.setViewportSize({ width: 640, height: 480 })
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 30 })
    // A pixel above the picture, in the middle of the window: the bar.
    expect(await pixelOf(page, 320, 4)).toEqual([0, 0, 0])
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)')
    await waitFor(page, { cutscene: null }, 600_000)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 30 })
    expect(await pixelOf(page, 320, 4)).toEqual([0, 0, 0])
    expect(await pixelOf(page, 320, 476)).toEqual([0, 0, 0])
  })
})
