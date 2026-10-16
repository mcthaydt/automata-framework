import { expect, test } from '@playwright/test'
import {
  collectErrors,
  embedUrl,
  gameFrame,
  openAndTimeReady,
  READY_WITHIN_MS,
} from '../../../tooling/itch-harness/e2e/journeys.ts'
import { BLOCKED_STORAGE_NOTICE } from '../src/boot.ts'

// The placeholder's itch build (`pnpm build:itch`) in the itch-like harness (tooling/itch-harness): its own
// origin, a subdirectory, an iframe on another origin with fullscreen allowed (PUB spec §7, §12 PUB-c).

test('is ready within 2 s, with no console errors', async ({ page }) => {
  const errors = collectErrors(page)
  const elapsed = await openAndTimeReady(page, embedUrl('placeholder'), 'placeholder')
  expect(elapsed, `ready after ${elapsed} ms`).toBeLessThan(READY_WITHIN_MS)
  const frame = await gameFrame(page, 'placeholder')
  await expect(frame.locator('#game')).toHaveText('Ready. Hello.')
  expect(errors).toEqual([])
})

test('a save survives a reload', async ({ page }) => {
  const errors = collectErrors(page)
  await openAndTimeReady(page, embedUrl('placeholder'), 'placeholder')
  await expect((await gameFrame(page, 'placeholder')).locator('#saves')).toHaveText('Visit 1.')
  await page.reload()
  await expect((await gameFrame(page, 'placeholder')).locator('#saves')).toHaveText('Visit 2.')
  expect(errors).toEqual([])
})

test('with storage blocked, saves are not granted, the notice shows and the game runs on', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const elapsed = await openAndTimeReady(page, embedUrl('placeholder', { blockStorage: true }), 'placeholder')
  expect(elapsed, `ready after ${elapsed} ms`).toBeLessThan(READY_WITHIN_MS)
  const frame = await gameFrame(page, 'placeholder')
  // The harness really denied the frame storage: the browser throws, not the game.
  const storage = await frame.evaluate(() => {
    try {
      return typeof window.localStorage.length === 'number' ? 'open' : 'denied'
    } catch {
      return 'denied'
    }
  })
  expect(storage).toBe('denied')
  await expect(frame.locator('#game')).toHaveText('Ready. Hello.')
  await expect(frame.locator('#saves')).toHaveText(BLOCKED_STORAGE_NOTICE)
  expect(errors).toEqual([])
})

test('fullscreen toggles from the game, where the browser has fullscreen', async ({ page }) => {
  const errors = collectErrors(page)
  await openAndTimeReady(page, embedUrl('placeholder'), 'placeholder')
  const frame = await gameFrame(page, 'placeholder')
  const inFullscreen = () => frame.evaluate(() => document.fullscreenElement !== null)
  const button = frame.locator('#fullscreen')
  // A phone WebKit has no Fullscreen API (as Safari on iPhone): the game offers no button there.
  if (!(await frame.evaluate(() => document.fullscreenEnabled === true))) {
    await expect(button).toBeHidden()
    expect(errors).toEqual([])
    return
  }
  await expect(button).toHaveText('Fullscreen')
  await button.click()
  await expect.poll(inFullscreen).toBe(true)
  await expect(button).toHaveText('Leave fullscreen')
  await button.click()
  await expect.poll(inFullscreen).toBe(false)
  await expect(button).toHaveText('Fullscreen')
  expect(errors).toEqual([])
})

test('offers no way “Back to …” a host it does not have', async ({ page }) => {
  await openAndTimeReady(page, embedUrl('placeholder'), 'placeholder')
  const frame = await gameFrame(page, 'placeholder')
  await expect(frame.getByRole('button', { name: /^Back to/ })).toHaveCount(0)
})
