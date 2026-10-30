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
  readonly elapsedMs: number
}

type ProbeWindow = { probe(scenario: string, run?: string): Promise<Report> }

async function probe(page: Page, scenario: string, run = ''): Promise<Report> {
  if (!page.url().startsWith(playgroundOrigin)) await page.goto(`${playgroundOrigin}/`)
  return page.evaluate(([name, id]) => (window as unknown as ProbeWindow).probe(name, id), [
    scenario,
    run,
  ] as const)
}

interface LoggedRequest {
  readonly path: string
  readonly search: string
  readonly status: number
}

async function requestsFor(page: Page, path: string, run: string): Promise<LoggedRequest[]> {
  const response = await page.request.get(`${playgroundOrigin}/requests`)
  const requests = (await response.json()) as LoggedRequest[]
  return requests.filter((request) => request.path === path && request.search === `?run=${run}`)
}

// A case that only succeeds when the policy let the load through needs no check that no violation happened; the
// load is the proof. Cases that expect a refusal name the error, so a typo or a 404 cannot pass for one.

test('a Blob module in an opaque-origin frame imports zod through the import map', async ({ page }) => {
  expect(await probe(page, 'blob-zod')).toMatchObject({ ok: true, value: 'parsed by zod' })
})

test("the frame's origin is opaque, and the site's own scripts and fetches still reach it ('self')", async ({
  page,
}) => {
  const report = await probe(page, 'fetch-self')
  expect(report).toMatchObject({ origin: 'null', ok: true, value: 'probe text\n' })
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
  expect(await probe(page, 'image-self')).toMatchObject({ ok: true, value: 4 })
  expect(await probe(page, 'image-self-cors')).toMatchObject({ ok: true, value: 4 })
})

test('the policy refuses a request to another origin', async ({ page }) => {
  const report = await probe(page, 'fetch-other-origin')
  expect(report.ok).toBe(false)
  expect(report.error).toMatch(/^TypeError/)
  expect(report.violations).toContain('connect-src')
})

test('a module without the /playground/ headers fails in the frame, and the same module with them loads', async ({
  page,
}) => {
  const run = crypto.randomUUID()
  const bare = await probe(page, 'bare-module', run)
  expect(bare.ok).toBe(false)
  expect(bare.error).toMatch(/^TypeError/)
  // The server did answer: the frame refused the response (CORS), not a missing file.
  expect((await requestsFor(page, '/bare/cache-probe.js', run)).map((request) => request.status)).toEqual([
    200,
  ])
  expect(await probe(page, 'module-with-headers', run)).toMatchObject({ ok: true, value: 'cache probe' })
})

test('the frame has no browser storage and cannot reach the page around it', async ({ page }) => {
  expect(await probe(page, 'storage')).toMatchObject({
    ok: false,
    error: expect.stringMatching(/^SecurityError/),
  })
  expect(await probe(page, 'parent-document')).toMatchObject({
    ok: false,
    error: expect.stringMatching(/^SecurityError/),
  })
})

// R-1, measured: does a second fresh frame fetch the immutable runtime module again? The answer is recorded in the
// WEB.PLAY.1 plan for PLAY-D5, not asserted, because either answer has a design. Both frames ask for this test's own
// copy (`?run=`), so the other engines' runs, in parallel, cannot change the count.
test('two fresh frames in turn both run the immutable module (R-1 measurement)', async ({
  page,
}, testInfo) => {
  const run = crypto.randomUUID()
  const counts: number[] = []
  const times: number[] = []
  for (let frame = 0; frame < 2; frame += 1) {
    const before = (await requestsFor(page, '/playground/runtime/cache-probe.js', run)).length
    const report = await probe(page, 'module-with-headers', run)
    expect(report.ok).toBe(true)
    counts.push((await requestsFor(page, '/playground/runtime/cache-probe.js', run)).length - before)
    times.push(report.elapsedMs)
  }
  const result = `server requests per frame: ${counts.join(', ')}; frame to report: ${times.join(', ')} ms`
  testInfo.annotations.push({ type: 'R-1', description: result })
  console.log(`R-1 ${testInfo.project.name}: ${result}`)
})
