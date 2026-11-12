import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { begin, stateOf, waitFor } from './driver.ts'

// Shoots the frames the audit compares with the old game's (docs/superpowers/audits): the opening cutscene as the first line is
// typed, and the hall in play at the spawn. Run by hand, since it saves pictures and asserts none:
//
//   AF_SHOOT=<folder> [AF_SHOOT_SIZES=1024x768,640x360] pnpm --filter @af-games/the-last-light test:e2e --grep frames
//
// Without `AF_SHOOT` it is skipped. It waits on the game's own state, never on a sleep.

const OUT = process.env.AF_SHOOT
const SIZES = (process.env.AF_SHOOT_SIZES ?? '1024x768').split(',').map((size) => {
  const [width, height] = size.split('x').map(Number)
  return { width: width as number, height: height as number }
})

test.skip(OUT === undefined, 'set AF_SHOOT to a folder to shoot frames into')
// A desktop window with a mouse: the journeys' phone context has a coarse pointer, so the game would draw its touch buttons over the
// frame, and the old game's frames (what these are compared with) have none.
test.use({ hasTouch: false, isMobile: false, deviceScaleFactor: 1 })
test.setTimeout(30 * 60_000)

for (const size of SIZES) {
  test(`frames at ${size.width}x${size.height}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.setViewportSize(size)
    const folder = OUT as string
    mkdirSync(folder, { recursive: true })
    await begin(page)
    // The first line typed out: Ada and the hall, as the opening's camera has them.
    await page.getByTestId('cutscene-caption').waitFor({ state: 'visible', timeout: 120_000 })
    await page.screenshot({ path: join(folder, `ours-cutscene-${size.width}x${size.height}.png`) })
    // Play: the opening over, Ada at the spawn.
    await waitFor(page, { cutscene: null }, 600_000)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 30 })
    await page.screenshot({ path: join(folder, `ours-play-${size.width}x${size.height}.png`) })
    expect(errors).toEqual([])
  })
}

// The touch layout, seen on purpose: a phone held sideways with a finger as its pointer, so the framework's six key buttons and the
// game's Skip button are drawn over the frame. Opening cutscene first (Skip), then play (the six buttons over the objective and the
// inventory's corners).
test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, deviceScaleFactor: 1, viewport: { width: 844, height: 390 } })

  test('frames on a phone', async ({ page }) => {
    const folder = OUT as string
    mkdirSync(folder, { recursive: true })
    await begin(page)
    await page.getByTestId('cutscene-caption').waitFor({ state: 'visible', timeout: 120_000 })
    await page.screenshot({ path: join(folder, 'ours-touch-cutscene-844x390.png') })
    await waitFor(page, { cutscene: null }, 600_000)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 30 })
    await page.screenshot({ path: join(folder, 'ours-touch-play-844x390.png') })
  })
})
