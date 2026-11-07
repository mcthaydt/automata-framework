import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, type Frame, type Locator, test } from '@playwright/test'
import { readCatalog } from '#src/catalog.ts'
import { demoHostOrigin, runnerFixturesPort } from '../../host/ports.ts'
import { collectErrors } from '../../host/testing.ts'

// The index page and its viewer (EX spec §5, EX.5) over the runner's fixtures: `core-stub` runs and
// `core-later` is pending. Runs at Pixel 7 (`examples`) and 780 × 270 (`examples-compact`). Screenshots go to
// evidence/examples-index/ for the Owner; they are never promoted automatically.
const fixture = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const root = fixture('../fixtures/examples/')
const entries = readCatalog(root, { deliveryPlan: fixture('../fixtures/catalog/delivery-plan.md') })
const origin = `http://localhost:${runnerFixturesPort}`
// The repository's (ignored) evidence/ folder, whichever folder the run started in.
const evidencePath = (name: string) => fixture(`../../../evidence/examples-index/${name}`)

const box = async (locator: Locator) => {
  const found = await locator.boundingBox()
  if (found === null) throw new Error('the element has no box')
  return found
}

test('the index lists every example under its module, pending ones as pending', async ({ page }, info) => {
  const errors = await collectErrors(page)
  await page.goto(`${origin}/`)
  for (const entry of entries) {
    const item = page.locator(`section[data-module="${entry.module}"] [data-example="${entry.id}"]`)
    await expect(item, entry.id).toBeVisible()
    await expect(item.getByRole('link', { name: 'Source' }), entry.id).toBeVisible()
    const pending = entry.header?.pending
    if (pending === undefined) await expect(item.getByRole('link', { name: 'View' }), entry.id).toBeVisible()
    else {
      await expect(item, entry.id).toContainText(`pending: ${pending}`)
      await expect(item.getByRole('link', { name: 'View' }), entry.id).toHaveCount(0)
    }
  }
  await page.screenshot({ path: evidencePath(`index-${info.project.name}.png`), fullPage: true })
  expect(errors).toEqual([])
})

test('View shows the running example in the fake host’s frame, with its source beside it', async ({
  page,
}, info) => {
  const stub = entries.find((entry) => entry.id === 'core-stub')
  if (stub === undefined) throw new Error('the fixtures have no core-stub')
  const errors = await collectErrors(page)
  await page.goto(`${origin}/`)
  await page.locator('[data-example="core-stub"]').getByRole('link', { name: 'View' }).click()
  await expect(page).toHaveURL(new RegExp(`^${demoHostOrigin}/`))

  // The game frame reaches ready under the fake host.
  const gameUrl = `${origin}${stub.url}`
  const frameAt = (url: string) => page.frames().find((candidate) => candidate.url() === url)
  await expect.poll(() => frameAt(gameUrl) !== undefined, { message: 'no game frame' }).toBe(true)
  await expect((frameAt(gameUrl) as Frame).locator('html')).toHaveAttribute('data-state', 'ready')

  // The source frame shows the file, as written.
  const sourceUrl = `${gameUrl}source/`
  await expect.poll(() => frameAt(sourceUrl) !== undefined, { message: 'no source frame' }).toBe(true)
  await expect((frameAt(sourceUrl) as Frame).locator('pre')).toHaveText(readFileSync(stub.file, 'utf8'), {
    useInnerText: false,
  })

  // Beside: both frames inside the viewport, not overlapping; side by side when wider than tall.
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('no viewport')
  const game = await box(page.locator('iframe[title="game"]'))
  const source = await box(page.locator('iframe[title="source"]'))
  for (const frame of [game, source]) {
    expect(frame.width).toBeGreaterThan(0)
    expect(frame.height).toBeGreaterThan(0)
    expect(frame.x + frame.width).toBeLessThanOrEqual(viewport.width)
    expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height)
  }
  if (viewport.width > viewport.height) expect(source.x).toBeGreaterThanOrEqual(game.x + game.width)
  else expect(source.y).toBeGreaterThanOrEqual(game.y + game.height)

  await page.screenshot({ path: evidencePath(`view-${info.project.name}.png`) })
  expect(errors).toEqual([])
})
