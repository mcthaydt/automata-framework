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
