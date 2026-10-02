import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium, devices, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const spikesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:"

const { values } = parseArgs({
  options: {
    page: { type: 'string' }, // entry page, relative to spikes/
    also: { type: 'string', multiple: true, default: [] }, // extra pages to build (e.g. an iframe)
    browser: { type: 'string', default: 'chromium' },
    query: { type: 'string', default: '' },
    csp: { type: 'boolean', default: false },
    throttle: { type: 'string', default: '1' }, // Chromium CPU throttle factor
    device: { type: 'string' }, // Playwright device descriptor name, e.g. "Pixel 7"
    'origin-host': { type: 'string' }, // open the page via this hostname (e.g. 127.0.0.1) instead of localhost
    headed: { type: 'boolean', default: false },
    screenshot: { type: 'string' },
    timeout: { type: 'string', default: '60000' },
  },
})
if (!values.page) throw new Error('--page is required (path relative to spikes/, e.g. s2-rapier/csp.html)')

const outDir = join(spikesRoot, 'out', values.page.replace(/[/.]/g, '_'))
const input = [values.page, ...values.also].map((p) => join(spikesRoot, p))
await build({
  root: spikesRoot,
  base: './',
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4096, rollupOptions: { input } },
})
const server = await preview({
  root: spikesRoot,
  base: './',
  build: { outDir },
  preview: {
    port: 0,
    host: values['origin-host'] ? true : 'localhost', // two-origin checks need both localhost and 127.0.0.1
    headers: values.csp ? { 'Content-Security-Policy': CSP } : {},
  },
  logLevel: 'warn',
})
const local = server.resolvedUrls?.local[0]
if (!local) throw new Error('preview server did not report a URL')
const origin = values['origin-host'] ? local.replace('localhost', values['origin-host']) : local

const browserType = { chromium, webkit, firefox }[values.browser as 'chromium' | 'webkit' | 'firefox']
const browser = await browserType.launch({
  headless: !values.headed,
  args: values.browser === 'chromium' ? ['--enable-unsafe-webgpu'] : [],
})
const context = await browser.newContext(
  values.device ? { ...devices[values.device] } : { viewport: { width: 480, height: 270 } },
)
const page = await context.newPage()
const violations: string[] = []
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`[page] ${m.text()}`)
})
await page.exposeFunction('__reportCspViolation', (v: string) => violations.push(v))
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => {
    ;(window as unknown as { __reportCspViolation: (v: string) => void }).__reportCspViolation(
      `${e.violatedDirective} ${e.blockedURI}`,
    )
  })
})
if (values.browser === 'chromium' && Number(values.throttle) > 1) {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(values.throttle) })
}

await page.goto(`${origin}${values.page}${values.query ? `?${values.query}` : ''}`)
let result: { ok?: boolean } & Record<string, unknown>
try {
  await page.waitForFunction(
    () => (window as unknown as { __result?: unknown }).__result !== undefined,
    null,
    {
      timeout: Number(values.timeout),
    },
  )
  result = await page.evaluate(() => (window as unknown as { __result: never }).__result)
} catch (err) {
  console.error(`TIMEOUT waiting for window.__result: ${String(err)}`)
  await browser.close()
  await server.close()
  process.exit(1)
}
if (values.screenshot) {
  mkdirSync(dirname(values.screenshot), { recursive: true })
  await page.locator('canvas').first().screenshot({ path: values.screenshot })
}
await browser.close()
await server.close()

const summary = {
  browser: values.browser,
  device: values.device ?? null,
  csp: values.csp,
  violations,
  ...result,
}
console.log(JSON.stringify(summary, null, 2))
if (violations.length > 0 || result.ok === false) process.exit(1)
