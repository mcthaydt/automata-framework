import { hostedUrl } from '@af-examples/demo-host/ports'
import { expect, type Page, test } from '@playwright/test'
import { GAME_ID, url } from './origin.ts'

// The physics demo under the fake host, with Ruken's headers: Rapier's wasm loads under Ruken's CSP, the
// bodies fall and collide, and a drop adds one more.

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`)
    })
  })
  return errors
}

test('boots under the fake host, ready and quiet; bodies collide, and a drop adds one', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto(hostedUrl(url, GAME_ID))
  const frame = page.frames().find((candidate) => candidate.url().startsWith(url))
  if (frame === undefined) throw new Error('the demo frame did not load')
  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')
  const game = frame.locator('#game')
  await expect(game).toHaveAttribute('data-bodies', '7')
  // The starting crates and stones land.
  await expect.poll(async () => Number(await game.getAttribute('data-bumps'))).toBeGreaterThan(0)
  await frame.locator('canvas').click()
  await page.keyboard.press('KeyX')
  await expect(game).toHaveAttribute('data-bodies', '8')
  expect(errors).toEqual([])
})
