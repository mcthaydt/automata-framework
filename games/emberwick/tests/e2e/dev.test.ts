import { readFileSync, writeFileSync } from 'node:fs'
import { passFirstRun } from '@automata/tools/e2e'
import { expect, test } from '@playwright/test'
import { devTuningFile, devUrl } from './origins.ts'

// Emberwick on its dev server (`pnpm dev`), the page the Tuner shows beside its settings. A saved tuning file
// starts the game over on the new tuning without reloading the page (main.ts accepts the content plugin's HMR
// update), back in the room the person was playing. The server compiles a copy of content/ (`pnpm e2e:dev`), so the
// committed tuning is never touched.

/**
 * How long a saved setting may take to reach the page and restart the game. `data-content-hash` is the signal: the
 * page sets it in the same turn that starts the new game, so nothing later in the chain is left to wait for, and
 * the server's own `automata:content` message comes before the page has applied anything. The server is quick
 * (save to Vite's update message: 0.1 s quiet, 0.3 s loaded) and the restart is instant (old game shut down and the
 * new one started within 40 ms). What takes the time is the page importing the changed modules again, a task queued
 * behind the room's frames, which the headless shell draws in software: 0.6 s on a quiet machine and 2.1 s with the page's
 * CPU throttled 8x, 3.7 s at 12x (measured), so it grows with the page's load while Playwright's 5 s for an
 * assertion does not. This is five times the 12x case.
 */
const HOT_RELOAD_MS = 20_000

test.describe('the dev server', () => {
  let original = ''
  test.beforeAll(() => {
    original = readFileSync(devTuningFile, 'utf8')
  })
  test.afterEach(() => writeFileSync(devTuningFile, original))

  test('a saved setting restarts the game on the new tuning, on the same page, in the room', async ({
    page,
  }) => {
    // The first load alone is a cold dev server transforming the game module by module (4.5 s of the 7 s on a quiet
    // machine, 12 s in all with four busy cores and 26 s with the page's CPU throttled 16x), so the default 30 s binds
    // a loaded run too closely. This binds the journey; HOT_RELOAD_MS caps the one wait that scales with the page.
    test.setTimeout(60_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(devUrl)
    await passFirstRun(page)
    const game = page.locator('#game')
    await expect(game).toHaveAttribute('data-content-hash', /^[0-9a-f]+$/)
    await expect(game).toHaveAttribute('data-screen', /splash|menu/)
    const first = await game.getAttribute('data-content-hash')
    // Into the room, where a person tuning the run plays.
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(game).toHaveAttribute('data-screen', 'room')
    // A reload would lose this.
    await page.evaluate(() => {
      ;(window as unknown as { marker: string }).marker = 'same page'
    })

    // What the Tuner writes when Running speed is dragged from 384 to 400.
    writeFileSync(devTuningFile, original.replace(/^MAX_RUN = \{ value = 384,/m, 'MAX_RUN = { value = 400,'))
    await expect(game).not.toHaveAttribute('data-content-hash', first ?? '', { timeout: HOT_RELOAD_MS })
    expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe('same page')
    // The new game is running, back in the room (no splash, no menu), and one game, not two, is in the root.
    await expect(game).toHaveAttribute('data-screen', 'room')
    await expect(game.locator('canvas')).toHaveCount(1)
    expect(errors).toEqual([])
  })
})
