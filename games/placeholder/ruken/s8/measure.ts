// Spike S8 (ship spec §3.9): what Effect costs a phone. Builds the placeholder twice (with Effect, as shipped,
// and without it: s8/no-effect.ts), then reports each build's gzip bytes and its cold boot to `ready` in
// Chromium under phone device descriptors with 4x CPU throttling, five runs each, median.
//
// Pages are served with the headers Ruken would send for this game (`compileHeaders` on the placeholder's
// manifest, so Ruken's CSP with no `eval`); a CSP violation fails the run.
//
// Run from games/placeholder: `node ruken/s8/measure.ts` (needs Playwright's Chromium; set
// PLAYWRIGHT_BROWSERS_PATH if it is not in the default place). Prints a Markdown table for
// docs/spikes/s8-effect.md. Its numbers are only as good as the machine it ran on, which the doc records.
//
//   --check        also fail (exit 1) when a budget in ruken/s8/budgets.ts is broken (CI's nightly run)
//   --sizes-only   build and weigh only, no browser (E1 and E3; CI's every-push run, with --check)
import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { checkManifest, rukenToml } from '@mcthaydt/automata-ship'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { chromium, devices } from 'playwright'
import { build } from 'vite'
import config from '../../ship.config.ts'
import { type Measurement, overBudget } from './budgets.ts'

const check = process.argv.includes('--check')
const sizesOnly = process.argv.includes('--sizes-only')

const here = import.meta.dirname
const placeholder = resolve(here, '..', '..')
const outRoot = resolve(placeholder, 'dist-s8')
const RUNS = 5
const CPU_THROTTLE = 4
// Playwright 1.63 has no Galaxy S20 descriptor; the S9+ is the closest Android phone it has (same class of
// viewport and pixel ratio, an older CPU, which the throttle stands in for anyway).
const PROFILES = ['Galaxy S9+', 'iPhone 13'] as const

interface Variant {
  readonly name: string
  readonly outDir: string
  readonly page: string
}

async function buildVariants(): Promise<Variant[]> {
  const withEffect = join(outRoot, 'effect')
  const withoutEffect = join(outRoot, 'no-effect')
  await build({ root: placeholder, logLevel: 'warn', build: { outDir: withEffect, emptyOutDir: true } })
  await build({
    root: here,
    base: './',
    logLevel: 'warn',
    build: {
      outDir: withoutEffect,
      emptyOutDir: true,
      rollupOptions: { input: join(here, 'no-effect.html') },
    },
  })
  return [
    { name: 'with Effect (shipped)', outDir: withEffect, page: 'index.html' },
    { name: 'without Effect', outDir: withoutEffect, page: 'no-effect.html' },
  ]
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
}

function bytesOf(variant: Variant): { raw: number; gzip: number } {
  let raw = 0
  let gzip = 0
  for (const path of filesUnder(variant.outDir).filter((file) => /\.(js|css|html)$/.test(file))) {
    const contents = readFileSync(path)
    raw += contents.length
    gzip += gzipSync(contents, { level: 9 }).length
  }
  return { raw, gzip }
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
}

const manifest = Effect.runSync(checkManifest(rukenToml(config)))

function serve(dir: string): Promise<{ server: Server; origin: string }> {
  let rukenHeaders: Record<string, string> = {}
  const server = createServer((request, response) => {
    const path = join(dir, decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname))
    if (!path.startsWith(dir) || !statSync(path, { throwIfNoEntry: false })?.isFile()) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      ...rukenHeaders,
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
    })
    createReadStream(path).pipe(response)
  })
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('no port')
      const origin = `http://127.0.0.1:${address.port}`
      rukenHeaders = compileHeaders(manifest, { hostOrigins: [origin] })
      done({ server, origin })
    })
  })
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN
}

// Cold boot: a fresh context (empty cache) per run; the time is performance.now() when the page sets
// data-state="ready", that is, from navigation start to the line of text after the SDK's handshake.
async function bootTimes(url: string, profile: (typeof PROFILES)[number]): Promise<number[]> {
  const { defaultBrowserType: _ignored, ...descriptor } = devices[profile]
  const browser = await chromium.launch()
  const times: number[] = []
  try {
    for (let run = 0; run < RUNS; run += 1) {
      const context = await browser.newContext(descriptor)
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE })
      const violations: string[] = []
      await page.exposeFunction('s8Violation', (directive: string) => violations.push(directive))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          ;(window as unknown as { s8Violation: (directive: string) => void }).s8Violation(
            event.violatedDirective,
          )
        })
        // Observes the document, not documentElement: the init script runs before <html> exists.
        new MutationObserver(() => {
          if (document.documentElement.dataset.state !== undefined) {
            ;(window as unknown as { s8Ready: number }).s8Ready = performance.now()
          }
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-state'] })
      })
      await page.goto(url)
      await page.waitForFunction(() => document.documentElement.dataset.state !== undefined)
      const state = await page.evaluate(() => document.documentElement.dataset.state)
      if (state !== 'ready') throw new Error(`${url} under ${profile} ended in state ${state}`)
      if (violations.length > 0) throw new Error(`${url} broke Ruken's CSP: ${violations.join(', ')}`)
      times.push(await page.evaluate(() => (window as unknown as { s8Ready: number }).s8Ready))
      await context.close()
    }
  } finally {
    await browser.close()
  }
  return times
}

const variants = await buildVariants()
const rows: string[] = []
const gzipOf: number[] = []
const mediansOf: number[][] = []
for (const variant of variants) {
  const { raw, gzip } = bytesOf(variant)
  gzipOf.push(gzip)
  const cells: string[] = []
  const medians: number[] = []
  if (!sizesOnly) {
    const { server, origin } = await serve(variant.outDir)
    try {
      for (const profile of PROFILES) {
        const times = await bootTimes(`${origin}/${variant.page}`, profile)
        medians.push(median(times))
        cells.push(`${median(times).toFixed(0)} ms (${times.map((time) => time.toFixed(0)).join(', ')})`)
      }
    } finally {
      server.close()
    }
  }
  mediansOf.push(medians)
  rows.push(
    [`| ${variant.name}`, `${(raw / 1000).toFixed(2)} kB`, `${(gzip / 1000).toFixed(2)} kB`, ...cells].join(
      ' | ',
    ) + ' |',
  )
}
const bootColumns = sizesOnly ? [] : PROFILES.map((profile) => `${profile}, ${CPU_THROTTLE}x CPU`)
console.log(['| Build', 'Raw (js+css+html)', 'Gzip', ...bootColumns].join(' | ') + ' |')
console.log(`|${['---', '---', '---', ...bootColumns.map(() => '---')].join('|')}|`)
for (const row of rows) console.log(row)

if (check) {
  const measured: Measurement = {
    gzip: { effect: gzipOf[0] ?? 0, noEffect: gzipOf[1] ?? 0 },
    bootMedians: sizesOnly
      ? []
      : PROFILES.map((profile, index) => ({
          profile,
          effect: mediansOf[0]?.[index] ?? Number.NaN,
          noEffect: mediansOf[1]?.[index] ?? Number.NaN,
        })),
  }
  const breaches = overBudget(measured)
  for (const breach of breaches) console.error(breach)
  if (breaches.length > 0) process.exit(1)
  console.log('S8 budgets met')
}
