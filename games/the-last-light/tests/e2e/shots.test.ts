import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { TICK_HZ } from '#src/shared/constants.ts'
import { ROUTE } from '#src/testing/route.ts'
import { begin, playRoute, stateOf, waitFor } from './driver.ts'

// Shoots a named cutscene at named seconds into it, for the audit's strips. Run by hand, since it saves pictures and asserts none:
//
//   AF_SHOOT=<folder> AF_SHOOT_AT='opening:5,8;lightsOut:10' pnpm --filter @af-games/the-last-light test:e2e --grep shots
//
// The opening is shot from the start; a later cutscene by playing the old solver's route up to the move that starts it
// (`lightsOut`: the bed made). Time is the sim clock's (`(tick - start) / 60`), so a slow software renderer shoots the same
// instants. Without `AF_SHOOT` it is skipped.

const OUT = process.env.AF_SHOOT
const WANTED = (process.env.AF_SHOOT_AT ?? 'opening:5,8')
  .split(';')
  .map((entry) => entry.split(':'))
  .map(([id, seconds]) => ({ id: id as string, seconds: (seconds ?? '').split(',').map(Number) }))

test.skip(OUT === undefined, 'set AF_SHOOT to a folder to shoot frames into')
test.use({ hasTouch: false, isMobile: false, deviceScaleFactor: 1 })
test.setTimeout(30 * 60_000)

/** The route's steps that lead to each cutscene, from play on screen. */
// `found`: the lamp put out at lights out and no hiding, so the figure finds her where she stands.
const LEAD: Record<string, number> = { keypad: 6, lightsOut: 9, found: 10, rest: 12 }

for (const { id, seconds } of WANTED) {
  test(`shots of ${id}`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    const folder = OUT as string
    mkdirSync(folder, { recursive: true })
    await begin(page)
    if (id !== 'opening') {
      await waitFor(page, { cutscene: null }, 600_000)
      // Stops once the move that starts the cutscene is answered; the rest of the route is not played.
      void playRoute(page, ROUTE.slice(0, LEAD[id] ?? 0)).catch(() => undefined)
    }
    await waitFor(page, { cutscene: id }, 600_000)
    const start = (await stateOf(page)).tick
    for (const at of seconds) {
      await waitFor(page, { tickAtLeast: start + Math.round(at * TICK_HZ) }, 600_000)
      await page.screenshot({ path: join(folder, `ours-${id}-t${at}-1024x768.png`) })
    }
    expect(await stateOf(page)).toBeDefined()
  })
}
