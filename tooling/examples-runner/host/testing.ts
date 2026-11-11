// What every demo's browser checks share: open the demo under the fake host, and collect console errors.
import { expect, type Frame, type Page } from '@playwright/test'
import { type HostedOptions, hostedUrl } from './ports.ts'

/**
 * Every console error, uncaught page error and CSP violation from here on, in the page and its frames; the
 * smoke tests expect none. Call it before `goto`.
 */
export async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  // Ruken's CSP blocks quietly in some engines; report each violation as a console error so the check sees it.
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`)
    })
  })
  return errors
}

/**
 * Opens the demo at `gameUrl` under the fake host and waits until the demo says it is ready. The host page sets
 * the frame's `src` from a module script after it loads, so the frame shows up some time after `goto`
 * returns: wait for it rather than look once (WebKit is slow enough to miss it).
 */
export async function openHosted(
  page: Page,
  gameUrl: string,
  gameId: string,
  options: HostedOptions = {},
): Promise<Frame> {
  await page.goto(hostedUrl(gameUrl, gameId, options))
  const demoFrame = () => page.frames().find((candidate) => candidate.url().startsWith(gameUrl))
  await expect.poll(() => demoFrame() !== undefined, { message: 'the demo frame did not load' }).toBe(true)
  const frame = demoFrame() as Frame
  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')
  return frame
}

/** How far the demo's sim has run: the `data-tick` on its `<html>`, or -1 until it says. */
export async function simTick(frame: Frame): Promise<number> {
  return Number((await frame.locator('html').getAttribute('data-tick')) ?? -1)
}

/**
 * Calls `sample` again and again until the sim has run `ticks` ticks past where it was at the start, and gives back
 * every sample. The loop runs at most 0.1 s of sim time a frame, so a machine that draws a frame a second runs the
 * sim at a tenth of real time: a journey that watches a cycle waits on the sim's clock, not the wall clock. `capMs`
 * is a hang guard only; it fails naming the tick reached.
 */
export async function sampleForSimTicks<T>(
  frame: Frame,
  ticks: number,
  sample: () => Promise<T>,
  { capMs = 90_000 }: { readonly capMs?: number } = {},
): Promise<T[]> {
  const begun = Date.now()
  const samples: T[] = []
  let start = -1
  for (;;) {
    const tick = await simTick(frame)
    if (start < 0) start = tick
    if (start >= 0 && tick - start >= ticks) return samples
    if (Date.now() - begun > capMs) {
      throw new Error(`the sim reached tick ${tick} (from ${start}) of ${ticks} ticks in ${capMs} ms`)
    }
    samples.push(await sample())
  }
}
