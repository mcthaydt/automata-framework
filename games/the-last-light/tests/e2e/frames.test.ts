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
