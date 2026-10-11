import { hostedUrl } from '@af-examples/demo-host/ports'
import { expect, type Frame, type Page, test } from '@playwright/test'
import { GAME_ID, url } from './origin.ts'

// The host demo under Ruken's fake host (examples/demo-host): it boots to ready with no console errors, reads
// the player's saves the host hands it, pauses while the host has it in the background, and writes a run back
// to the host's saves when Wick reaches the ember.

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

async function openHosted(page: Page, saves?: Record<string, string>): Promise<Frame> {
  await page.goto(hostedUrl(url, GAME_ID, saves))
  const frame = page.frames().find((candidate) => candidate.url().startsWith(url))
  if (frame === undefined) throw new Error('the demo frame did not load')
  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')
  return frame
}

test('boots under the fake host, ready and quiet, showing the saves it was handed', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, { 'best-ticks': '600', runs: '3' })
  const game = frame.locator('#game')
  await expect(game).toHaveAttribute('data-host', 'ruken')
  await expect(game).toHaveAttribute('data-lifecycle', 'active')
  await expect(frame.getByText('Best 10.00 s')).toBeVisible()
  await expect(frame.getByText('3 runs')).toBeVisible()
  await expect(game).toHaveAttribute('data-tick', /\d+/)
  expect(errors).toEqual([])
})

test('stops the room while the host has it in the background, and plays on after', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page)
  const game = frame.locator('#game')
  await page.evaluate(() =>
    (window as unknown as { hostBridge: { setOverlay(o: string): void } }).hostBridge.setOverlay('drawer'),
  )
  await expect(game).toHaveAttribute('data-lifecycle', 'background')
  const pausedAt = Number(await game.getAttribute('data-tick'))
  await page.waitForTimeout(300)
  expect(Number(await game.getAttribute('data-tick'))).toBe(pausedAt)
  await page.evaluate(() =>
    (window as unknown as { hostBridge: { setOverlay(o: string): void } }).hostBridge.setOverlay('none'),
  )
  await expect(game).toHaveAttribute('data-lifecycle', 'active')
  await expect.poll(async () => Number(await game.getAttribute('data-tick'))).toBeGreaterThan(pausedAt)
  expect(errors).toEqual([])
})

test('reaching the ember counts a run and writes it to the host saves', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, { 'best-ticks': '6000', runs: '3' })
  const game = frame.locator('#game')
  // Keys reach the frame that has focus.
  await frame.locator('canvas').click()
  await page.keyboard.down('ArrowRight')
  await expect(game).toHaveAttribute('data-runs', '4')
  await page.keyboard.up('ArrowRight')
  await expect(frame.getByText('4 runs')).toBeVisible()
  // A dash takes a couple of seconds, well under the seeded 100 s best.
  await expect(frame.getByText(/^Best \d\.\d\d s$/)).toBeVisible()
  const trace = () => page.evaluate(() => (window as unknown as { hostTrace(): string[] }).hostTrace())
  await expect.poll(trace).toContain('saves.set')
  // The round's start and its end, each reported to the host.
  expect((await trace()).filter((type) => type === 'telemetry.round').length).toBeGreaterThanOrEqual(2)
  expect(errors).toEqual([])
})

test('opened directly, it runs standalone', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('#game')).toHaveAttribute('data-host', 'standalone')
  expect(errors).toEqual([])
})
