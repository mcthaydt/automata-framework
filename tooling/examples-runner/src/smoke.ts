// The smoke test every example gets, parametric over the catalog so adding an example adds no
// test file: it boots under the fake host with the header's `Host:` settings, reaches the semantic ready, and
// logs no console error or CSP violation. A pending example is reported as skipped with its task, never as passed.
import { expect, type Frame, test } from '@playwright/test'
import { collectErrors, openHosted } from '../host/testing.ts'
import type { CatalogEntry } from './catalog.ts'

/**
 * Defines, under `suite`, the index test and one smoke test per entry; `origin` is where the examples build is
 * served.
 */
export function smokeExamples(suite: string, entries: readonly CatalogEntry[], origin: string): void {
  test.describe(suite, () => defineSmokeTests(entries, origin))
}

function defineSmokeTests(entries: readonly CatalogEntry[], origin: string): void {
  test('the index lists every example and logs no errors', async ({ page }) => {
    const errors = await collectErrors(page)
    await page.goto(`${origin}/`)
    await expect(page.locator('h1')).toHaveText('AF examples')
    await expect(page.locator('[data-example]')).toHaveCount(entries.length)
    expect(errors).toEqual([])
  })

  for (const entry of entries) {
    test(`${entry.id} boots under the fake host with no errors`, async ({ page }) => {
      const pending = entry.header?.pending
      test.skip(pending !== undefined, `pending: ${pending}`)
      const errors = await collectErrors(page)
      // Each example says hello under its own id (`defineGame` makes it the hosting game id), and the fake host
      // refuses a hello from any other game. The shared manifest (vite-plugin.ts) only sets the
      // pages' headers.
      const frame = await openHosted(page, `${origin}${entry.url}`, entry.id, entry.header?.host ?? {})
      await playAndRun(frame)
      expect(errors).toEqual([])
    })
  }
}

/** How many animation frames the started example runs before the error check. */
const FRAMES_AFTER_PLAY = 30

/**
 * Starts the example the way a player does (Play on the title, when it has one) and lets it run. A room's assets
 * load after Play, so a refused fetch (Ruken's CSP) or a missing file only logs from here on: ready is too early.
 * The wait counts the game's own animation frames, not milliseconds.
 */
async function playAndRun(frame: Frame): Promise<void> {
  const play = frame.getByTestId('play')
  if (!(await play.isVisible())) return
  await play.click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        let count = 0
        const step = (): void => {
          count += 1
          if (count >= frames) resolve()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    FRAMES_AFTER_PLAY,
  )
}
