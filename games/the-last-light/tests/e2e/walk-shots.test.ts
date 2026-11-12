import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@playwright/test'
import { begin, stateOf, waitFor } from './driver.ts'

// Shoots the play frames of a framing, by hand: at 1024 by 768, the opening skipped through the probe, Ada walked by holding a key for a
// number of sim ticks (a software renderer runs the sim slowly, so a position cannot be waited for; a wall stops her). Saves pictures and
// asserts none. Without `AF_SHOOT` it is skipped:
//
//   AF_WEBGPU=software AF_SHOOT=<folder> pnpm --filter @af-games/the-last-light test:e2e --grep "walk frames"
const OUT = process.env.AF_SHOOT as string
test.skip(OUT === undefined, 'set AF_SHOOT to a folder to shoot frames into')
test.use({ hasTouch: false, isMobile: false, deviceScaleFactor: 1 })
test.setTimeout(30 * 60_000)

type Step = [name: string, key: string, ticks: number]
// Held for a number of sim ticks; a wall stops her. Software GL runs the sim slowly, so a position cannot be waited for.
const STEPS: Step[] = [
  ['01-south-wall', 'KeyS', 150],
  ['02-west', 'KeyA', 260],
  ['03-east', 'KeyD', 520],
  ['04-north-east', 'KeyW', 260],
  ['05-hall-north', 'KeyA', 200],
  ['06-mouth', 'KeyW', 200],
  ['07-corridor', 'KeyW', 200],
  ['08-corridor-end', 'KeyW', 300],
]

test('walk frames', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.setViewportSize({ width: 1024, height: 768 })
  mkdirSync(OUT, { recursive: true })
  await begin(page)
  await page.evaluate(() => globalThis.__lastLight?.skip())
  await waitFor(page, { cutscene: null }, 600_000)
  await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 90 })
  await page.screenshot({ path: join(OUT, '00-spawn.png') })
  for (const [name, key, ticks] of STEPS) {
    await page.keyboard.down(key)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + ticks }, 300_000)
    await page.keyboard.up(key)
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 75 })
    await page.screenshot({ path: join(OUT, `${name}.png`) })
    console.log(name, JSON.stringify((await stateOf(page)).ada))
  }
  console.log('ERRORS', JSON.stringify(errors.slice(0, 5)))
})
