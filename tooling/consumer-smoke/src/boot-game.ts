// The smoke's boot step (DX.2a): opens the minimal game's web build in Chromium, as a player would, and waits on
// the game's own readiness, never on a timer: the runtime marks `<html data-state="ready">` once boot finishes,
// the title screen's Play starts play, and the game then runs some of its own animation frames. Any console
// error, uncaught error or CSP violation on the way fails the step.
import { chromium } from 'playwright'

/** How many animation frames the started game runs before the error check (the examples' smoke runs 30). */
const FRAMES_AFTER_PLAY = 30
const READY_TIMEOUT_MS = 30_000

/** The browser for the step, with the fix when Playwright's Chromium is not installed. */
async function launch() {
  try {
    return await chromium.launch()
  } catch (error) {
    throw new Error(
      `no Chromium to boot the game in: run pnpm exec playwright install chromium (or set PLAYWRIGHT_BROWSERS_PATH)\n${String(error)}`,
    )
  }
}

/** Boots the game served at `url`; resolves with what it saw, rejects naming the first thing that went wrong. */
export async function bootGame(url: string): Promise<string> {
  const browser = await launch()
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(String(error)))
    // Some engines block quietly under a CSP; report each violation so the check sees it.
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`)
      })
    })
    await page.goto(url)
    const failed = (what: string) => (error: unknown) => {
      throw new Error(`${what}; errors: ${JSON.stringify(errors)}\n${String(error)}`)
    }
    await page
      .locator('html[data-state="ready"]')
      .waitFor({ state: 'attached', timeout: READY_TIMEOUT_MS })
      .catch(failed('the game never said it was ready'))
    await page.getByTestId('play').click({ timeout: READY_TIMEOUT_MS }).catch(failed('no Play on the title'))
    await page
      .getByTestId('play-screen')
      .waitFor({ timeout: READY_TIMEOUT_MS })
      .catch(failed('Play did not reach the play screen'))
    await page.evaluate(
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
    const canvases = await page.locator('canvas').count()
    if (errors.length > 0) throw new Error(`the game logged errors:\n${errors.join('\n')}`)
    if (canvases === 0) throw new Error('the game drew no canvas')
    return `ready, Play reached the play screen, ${FRAMES_AFTER_PLAY} frames, no errors`
  } finally {
    await browser.close()
  }
}
