import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { type ServedFolder, serveFolder } from '../harness/serve-folder.ts'

// The suite page on the site's "Try the editor" (plan task 15.2): served under /editor/app/, not at the root, and with
// the site's strict policy for its own builds: scripts from the site only, no eval. The page names its files relative
// to itself, and Pixi's no-eval build is imported first, so the level canvas draws instead of saying "Preview
// unavailable". Build first: `pnpm build` (this page is `extensions/editors/dist/suite`).

const EDITOR = fileURLToPath(new URL('../../../../../extensions/editors/dist/suite', import.meta.url))
// The same text as the site's `DEMO_POLICY` (site/src/shared/html/security-headers.ts).
const POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

let site: ServedFolder
test.beforeAll(async () => {
  site = await serveFolder(EDITOR, { prefix: '/editor/app/', headers: { 'Content-Security-Policy': POLICY } })
})
test.afterAll(async () => {
  await site.stop()
})

test('opens under /editor/app/ and draws a level with no eval', async ({ page }) => {
  const refusals: string[] = []
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) refusals.push(message.text())
  })
  await page.goto(site.url)
  await page.getByRole('button', { name: 'New level' }).click()
  await page.getByRole('button', { name: /Platformer/ }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
  expect(refusals).toEqual([])
})
