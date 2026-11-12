import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@playwright/test'
import { begin, stateOf, waitFor } from './driver.ts'

// Shoots play frames at chosen places, by hand: 1024 by 768, the opening skipped through the probe, Ada walked by holding a key for a number
// of sim ticks (a software renderer runs the sim slowly, so a position cannot be waited for; a wall stops her). Saves pictures and asserts
// none. Without `AF_SHOOT` it is skipped. `AF_SHOOT_STEPS` is `name:Key:ticks` entries joined by `;` (default: the hall's south wall, facing us);
// each takes its frame once the sim has settled 75 ticks after the key is up. A `drag` entry (`name:drag:px`) turns the camera instead: the
// mouse drags `px` to the right (negative: left) across the scene with its left button, as a player turns it. The keys walk relative to the
// camera, so after a turn a key walk goes somewhere else; a `walk` entry (`name:walk:x,z`) walks her to a point on the plan in metres instead
// (the probe's nav walk), and a `face` entry (`name:face:deg`) turns the camera to a heading in degrees (0 looks toward +z, so 0 frames her
// from the north): a shot then means the same place and the same view whatever came before it. A `name` of `-` takes no frame.
//
//   AF_WEBGPU=software AF_SHOOT=<folder> AF_SHOOT_STEPS='-:walk:0,-6.2;corridor-end:face:0' pnpm --filter @af-games/the-last-light test:e2e --grep "play frames"
const OUT = process.env.AF_SHOOT
const STEPS = (process.env.AF_SHOOT_STEPS ?? 'hall-south:KeyS:150').split(';').map((entry) => {
  const [name = '', key = '', arg = '0'] = entry.split(':')
  return { name, key, arg, ticks: Number(arg) }
})
/** Turn units in a whole turn, as the sim counts a heading. */
const TURN = 65_536

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
  for (const { name, key, arg, ticks } of STEPS) {
    if (key === 'walk') {
      const [x = 0, z = 0] = arg.split(',').map(Number)
      await page.evaluate(([x, z]) => globalThis.__lastLight?.walk(x, z), [x, z] as const)
      // There once she has stopped within a few centimetres of it, or as near as a wall lets her (her place stops changing).
      let last = { x: Number.NaN, z: Number.NaN }
      for (;;) {
        await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 20 }, 300_000)
        const at = (await stateOf(page)).ada ?? last
        if (Math.hypot(at.x - x, at.z - z) < 0.05 || Math.hypot(at.x - last.x, at.z - last.z) < 0.001) break
        last = at
      }
    } else if (key === 'face') {
      const want = Math.round((ticks * TURN) / 360) & (TURN - 1)
      while (Math.abs(((((await stateOf(page)).heading ?? want) - want + TURN / 2) % TURN) - TURN / 2) > 1) {
        await page.evaluate((deg) => globalThis.__lastLight?.face(deg), ticks)
        await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 2 })
      }
    } else if (key === 'drag') {
      await page.mouse.move(512 - ticks / 2, 300)
      await page.mouse.down()
      await page.mouse.move(512 + ticks / 2, 300, { steps: 8 })
      await page.mouse.up()
    } else {
      await page.keyboard.down(key)
      await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + ticks }, 300_000)
      await page.keyboard.up(key)
    }
    await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 75 })
    if (name !== '-') await page.screenshot({ path: join(folder, `${name}.png`) })
  }
})
