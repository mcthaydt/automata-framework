import { expect, test } from '@playwright/test'
import { begin, stateOf, waitFor } from './driver.ts'

// The old game's picture: its LCD panel and its retro grade are on in the opening cutscene and in play, and the grade's film (grain,
// dust, scratch) holds still for a player whose system asks for less motion. It reads the passes the renderer made through the
// development build's hook, and waits on the game's own state, never on a sleep.

const looks = (page: import('@playwright/test').Page) => page.evaluate(() => globalThis.__lastLightLook?.())

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
