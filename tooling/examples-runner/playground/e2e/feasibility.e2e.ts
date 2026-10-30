import { expect, type Page, test } from '@playwright/test'
import { playgroundOrigin } from '../../host/ports.ts'

// WEB.PLAY.1 (website playground spec §17): can the playground's design run at all? Each case frames the site's
// frame page in `sandbox="allow-scripts"` (an opaque origin) under the §11.2 policy and reads what the frame
// reports. The parent page's `probe` (static/parent.js) resolves with the frame's one report.

interface Report {
  readonly scenario: string
  readonly origin: string
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: string
  readonly violations: readonly string[]
}

async function probe(page: Page, scenario: string): Promise<Report> {
  await page.goto(`${playgroundOrigin}/`)
  return page.evaluate(
    (name) => (window as unknown as { probe(s: string): Promise<Report> }).probe(name),
    scenario,
  )
}

test('a Blob module in an opaque-origin frame imports zod through the import map', async ({ page }) => {
  const report = await probe(page, 'blob-zod')
  expect(report).toMatchObject({ ok: true, value: 'parsed by zod', violations: [] })
})

test("the frame's origin is opaque, and the site's own module scripts still load in it ('self')", async ({
  page,
}) => {
  const report = await probe(page, 'fetch-self')
  expect(report).toMatchObject({ origin: 'null', ok: true, value: 'probe text\n', violations: [] })
  expect(report).toHaveProperty('parentCanRead', false)
})

// WebKit throws without a securitypolicyviolation event for eval, so the case reads the error, not the event.
test('the policy refuses eval', async ({ page }) => {
  const report = await probe(page, 'eval')
  expect(report.ok).toBe(false)
  expect(report.error).toMatch(/^EvalError/)
})

// Pixi loads textures as images or with fetch, and sounds with fetch.
test('the frame loads images from the site, plain and with CORS', async ({ page }) => {
  expect(await probe(page, 'image-self')).toMatchObject({ ok: true, value: 4, violations: [] })
  expect(await probe(page, 'image-self-cors')).toMatchObject({ ok: true, value: 4, violations: [] })
})

test('the policy refuses a request to another origin', async ({ page }) => {
  const report = await probe(page, 'fetch-other-origin')
  expect(report.ok).toBe(false)
  expect(report.violations).toContain('connect-src')
})

test('a module without the /playground/ headers fails in the frame, and the same module with them loads', async ({
  page,
}) => {
  const bare = await probe(page, 'bare-module')
  expect(bare.ok).toBe(false)
  expect(bare.violations).toEqual([])
  const served = await probe(page, 'module-with-headers')
  expect(served).toMatchObject({ ok: true, value: 'cache probe', violations: [] })
})

test('the frame has no browser storage and cannot reach the page around it', async ({ page }) => {
  expect((await probe(page, 'storage')).ok).toBe(false)
  expect((await probe(page, 'parent-document')).ok).toBe(false)
})

// R-1, measured: does a second fresh frame fetch the immutable runtime module again? The answer is recorded in the
// WEB.PLAY.1 plan for PLAY-D5, not asserted, because either answer has a design.
test('two fresh frames in turn both run the immutable module (R-1 measurement)', async ({
  page,
}, testInfo) => {
  const counts: number[] = []
  for (let frame = 0; frame < 2; frame += 1) {
    const before = await countRequests(page, '/playground/runtime/cache-probe.js')
    const report = await page.evaluate(() =>
      (window as unknown as { probe(s: string): Promise<Report> }).probe('module-with-headers'),
    )
    expect(report.ok).toBe(true)
    counts.push((await countRequests(page, '/playground/runtime/cache-probe.js')) - before)
  }
  testInfo.annotations.push({ type: 'R-1', description: `server requests per frame: ${counts.join(', ')}` })
  console.log(`R-1 ${testInfo.project.name}: server requests for the module, frame 1 then frame 2: ${counts}`)
})

async function countRequests(page: Page, path: string): Promise<number> {
  if (page.url() === 'about:blank') await page.goto(`${playgroundOrigin}/`)
  const response = await page.request.get(`${playgroundOrigin}/requests`)
  const requests = (await response.json()) as { path: string }[]
  return requests.filter((request) => request.path === path).length
}
