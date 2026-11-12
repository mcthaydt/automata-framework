import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@playwright/test'
import { begin, stateOf, waitFor } from './driver.ts'

// Shoots play frames at chosen places, by hand: 1024 by 768, the opening skipped through the probe, Ada walked by holding a key for a number
// of sim ticks (a software renderer runs the sim slowly, so a position cannot be waited for; a wall stops her). Saves pictures and asserts
// none. Without `AF_SHOOT` it is skipped. `AF_SHOOT_STEPS` is `name:Key:ticks` entries joined by `;` (default: the hall's south wall, facing us);
// each takes its frame once the sim has settled 75 ticks after the key is up. Keys joined by `+` are held together (`KeyS+KeyD` walks
// her down and right, so she stops in three-quarter).
//
//   AF_WEBGPU=software AF_SHOOT=<folder> AF_SHOOT_STEPS='south:KeyS:150;east:KeyD:520' pnpm --filter @af-games/the-last-light test:e2e --grep "play frames"
const OUT = process.env.AF_SHOOT
const STEPS = (process.env.AF_SHOOT_STEPS ?? 'hall-south:KeyS:150').split(';').map((entry) => {
  const [name = '', key = '', ticks = '0'] = entry.split(':')
  return { name, key, ticks: Number(ticks) }
})

test.skip(OUT === undefined, 'set AF_SHOOT to a folder to shoot frames into')
test.use({ hasTouch: false, isMobile: false, deviceScaleFactor: 1 })
test.setTimeout(30 * 60_000)

test('play frames', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const folder = OUT as string
  mkdirSync(folder, { recursive: true })
  await begin(page)
  await page.evaluate(() => globalThis.__lastLight?.skip())
  await waitFor(page, { cutscene: null }, 600_000)
  await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 90 })
  for (const { name, key, ticks } of STEPS) {
    const keys = key.split('+')
    for (const k of keys) await page.keyboard.down(k)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + ticks }, 300_000)
    // Released in one task, so no tick sees one key of a pair still held (it would turn her side-on before she stops).
    await page.evaluate((codes) => {
      for (const code of codes)
        (document.activeElement ?? document.body).dispatchEvent(
          new KeyboardEvent('keyup', { code, bubbles: true }),
        )
    }, keys)
    for (const k of keys) await page.keyboard.up(k)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 75 })
    await page.screenshot({ path: join(folder, `${name}.png`) })
  }
})
