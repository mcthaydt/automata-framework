import { expect, type Page, test } from '@playwright/test'
import { gameOrigin, hostOrigin } from './origins.ts'

// The placeholder in a real browser, served with the headers Ruken would serve it with (vite.config.ts,
// compileHeaders). Standalone it greets nobody; inside a fake Ruken host frame on another origin it completes
// the real handshake and greets the player. Both fail on any console error, CSP violations included.

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

test('boots standalone under Ruken’s headers and says hello', async ({ page }) => {
  const errors = collectErrors(page)
  const response = await page.goto(`${gameOrigin}/`)
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('#game')).toHaveText('Ready. Hello.')
  expect(errors).toEqual([])
})

test('completes the Ruken handshake inside a fake host frame on another origin', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(`${hostOrigin}/`)
  await expect(page.frameLocator('iframe').locator('#game')).toHaveText('Ready. Hello, Ada.')
  const trace = await page.evaluate(() => (window as unknown as { hostTrace: () => string[] }).hostTrace())
  expect(trace.slice(0, 3)).toEqual(['hello', 'welcome', 'session.ready'])
  expect(errors).toEqual([])
})
