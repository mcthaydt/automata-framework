import type { HostedOptions } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Frame, type Page, test } from '@playwright/test'
import { GAME_ID, url } from './origin.ts'

// The host demo under Ruken's fake host (tooling/examples-runner/host): it boots to ready with no console errors, reads
// the player's saves the host hands it, pauses while the host has it in the background, and writes a run back
// to the host's saves when Wick reaches the ember.

/** The demo under the fake host; `options` as `hostedUrl` takes them. */
const openDemo = (page: Page, options?: HostedOptions) => openHosted(page, url, GAME_ID, options)

test('boots under the fake host, ready and quiet, showing the saves it was handed', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openDemo(page, { saves: { 'best-ticks': '600', runs: '3' } })
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
  const frame = await openDemo(page)
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
  const frame = await openDemo(page, { saves: { 'best-ticks': '6000', runs: '3' } })
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

/** Holds right until Wick reaches the ember and the run is counted. */
async function dashToEmber(page: Page, game: ReturnType<Frame['locator']>, runs: number) {
  await page.keyboard.down('ArrowRight')
  await expect(game).toHaveAttribute('data-runs', String(runs))
  await page.keyboard.up('ArrowRight')
}

test('with saves denied, it keeps nothing and says so', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openDemo(page, { grant: [], saves: { runs: '3' } })
  const game = frame.locator('#game')
  await expect(game).toHaveAttribute('data-saves', 'not-granted')
  await expect(frame.getByText('Saves: not granted, runs are not kept')).toBeVisible()
  // The host's saves were not read...
  await expect(frame.getByText('0 runs')).toBeVisible()
  await frame.locator('canvas').click()
  await dashToEmber(page, game, 1)
  await expect(frame.getByText('1 run')).toBeVisible()
  // ...nor written, and nothing went to the device instead.
  const trace = await page.evaluate(() => (window as unknown as { hostTrace(): string[] }).hostTrace())
  expect(trace.filter((type) => type.startsWith('saves.'))).toEqual([])
  expect(await frame.evaluate(() => localStorage.length)).toBe(0)
  expect(errors).toEqual([])
})

test('with the saves server out of reach, the run queues on the host', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openDemo(page, { offline: true })
  const game = frame.locator('#game')
  await frame.locator('canvas').click()
  await dashToEmber(page, game, 1)
  await expect(game).toHaveAttribute('data-saves', 'offline-queued')
  await expect(frame.getByText('Saves: offline-queued')).toBeVisible()
  expect(await frame.evaluate(() => localStorage.length)).toBe(0)
  expect(errors).toEqual([])
})

test('opened directly, it runs standalone', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('#game')).toHaveAttribute('data-host', 'standalone')
  // No host, so nothing to deny: the panel says runs last as long as the page, not that saves were refused.
  await expect(page.locator('#game')).toHaveAttribute('data-saves', 'standalone')
  await expect(page.getByText('Saves: this page only')).toBeVisible()
  expect(errors).toEqual([])
})
