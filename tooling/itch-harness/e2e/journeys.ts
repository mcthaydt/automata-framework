import { expect, type Frame, type Page } from '@playwright/test'
import { itchHarnessPorts } from '../src/ports.ts'

// What every game's itch-harness journey shares (PUB spec §7): where the embed page is, the game's frame, and
// the console errors of the page and every frame in it.

const ports = itchHarnessPorts(process.env)

/** The embed page framing `game`, with the frame's storage blocked when asked. */
export function embedUrl(game: string, options: { blockStorage?: boolean } = {}): string {
  const query = new URLSearchParams({ game })
  if (options.blockStorage === true) query.set('storage', 'blocked')
  return `http://127.0.0.1:${ports.page}/?${query}`
}

/** Where the harness serves `game`'s build: its own origin, under /html/<game>/, as itch.io serves an upload. */
export function gameUrl(game: string): string {
  return `http://localhost:${ports.game}/html/${game}/index.html`
}

/** The game's frame once it has loaded. */
export async function gameFrame(page: Page, game: string): Promise<Frame> {
  await expect.poll(() => page.frames().some((frame) => frame.url() === gameUrl(game))).toBe(true)
  const frame = page.frames().find((candidate) => candidate.url() === gameUrl(game))
  if (frame === undefined) throw new Error(`no frame for ${game}`)
  return frame
}

/** Console errors and uncaught errors from the page and its frames. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

/** PUB spec §12 PUB-c: ready within 2 s of navigation. Today a Ruken build in a foreign frame waits 10 s. */
export const READY_WITHIN_MS = 2000

/**
 * Opens the embed page and waits for the game to say ready, then returns how long that took from the start of
 * navigation. The wait itself is longer than the budget, so a slow boot fails on the measured time, not a timeout.
 */
export async function openAndTimeReady(page: Page, url: string, game: string): Promise<number> {
  const started = Date.now()
  await page.goto(url)
  const frame = await gameFrame(page, game)
  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready', { timeout: 15_000 })
  return Date.now() - started
}
