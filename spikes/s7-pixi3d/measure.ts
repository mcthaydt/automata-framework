// Spike S7 part 1 (M3.1a): builds the pages, serves them with the headers Ruken would send (`compileHeaders` from
// the vendored @ruken/manifest on ./ruken.toml: Ruken's CSP with no 'unsafe-eval'), and runs them in Chromium,
// WebKit and Firefox. Answers S7-Q1 (boots, renders, zero CSP violations and zero console errors), the runtime half
// of S7-Q5 (the mount in setup, the delta consumer over Container3D, the camera's fov), S7-Q7 (gzip bytes) and S7-g
// (the extras page records a violation; the guard finds extras in its bundle).
//
// Run from spikes/s7-pixi3d with PLAYWRIGHT_BROWSERS_PATH set: `node measure.ts`. Writes out/results.json and
// prints the Markdown for docs/spikes/s7-pixi3d.md. Headless browsers in a container have no GPU: the WebGL2
// numbers come from software rasterisers, which the results name (the GPU runner is M3.1b's).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { compileHeaders, parseManifest } from '@ruken/manifest'
import { type Browser, type BrowserType, chromium, firefox, webkit } from 'playwright'
import { PNG } from 'pngjs'
import { findExtras } from './src/bundle/extras-guard.ts'

const here = import.meta.dirname
const out = join(here, 'out')
const VIEWPORT = { width: 1280, height: 720 }

interface Build {
  readonly name: string
  readonly dir: string
}

function viteBuild(name: string, variant?: string): Build {
  const dir = join(out, `build-${name}`)
  execFileSync(join(here, 'node_modules/.bin/vite'), ['build', '--logLevel', 'warn'], {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, S7_OUT: dir, ...(variant ? { S7_VARIANT: variant } : {}) },
  })
  return { name, dir }
}

// --- S7-Q7: bytes --------------------------------------------------------------------------------------------

interface ManifestChunk {
  readonly file: string
  readonly imports?: readonly string[]
  readonly dynamicImports?: readonly string[]
  readonly css?: readonly string[]
}

const gzipOf = (path: string) => gzipSync(readFileSync(path), { level: 9 }).length

/** The entry's JS and CSS, split into what loads up front (static imports) and what it may load later. */
function entryBytes(build: Build, html: string) {
  const manifest = JSON.parse(readFileSync(join(build.dir, '.vite/manifest.json'), 'utf8')) as Record<
    string,
    ManifestChunk
  >
  const staticFiles = new Set<string>()
  const lazyFiles = new Set<string>()
  const walk = (key: string, lazy: boolean) => {
    const chunk = manifest[key]!
    const into = lazy ? lazyFiles : staticFiles
    if (staticFiles.has(chunk.file) || into.has(chunk.file)) return
    into.add(chunk.file)
    for (const css of chunk.css ?? []) into.add(css)
    for (const next of chunk.imports ?? []) walk(next, lazy)
    for (const next of chunk.dynamicImports ?? []) walk(next, true)
  }
  walk(html, false)
  for (const file of staticFiles) lazyFiles.delete(file)
  const sum = (files: Set<string>) =>
    [...files].reduce((total, file) => total + gzipOf(join(build.dir, file)), 0)
  return { upfront: sum(staticFiles), lazy: sum(lazyFiles), all: sum(staticFiles) + sum(lazyFiles) }
}

// --- the server ----------------------------------------------------------------------------------------------

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
}

async function serve(build: Build): Promise<{ server: Server; origin: string }> {
  const parsed = parseManifest(readFileSync(join(here, 'ruken.toml'), 'utf8'))
  if (!parsed.ok) throw new Error(`ruken.toml: ${JSON.stringify(parsed.errors)}`)
  let headers: Record<string, string> = {}
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)).replace(
      /^\/+/,
      '',
    )
    const file = resolve(build.dir, path === '' ? 'index.html' : path)
    if (!file.startsWith(build.dir) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      ...headers,
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    })
    response.end(readFileSync(file))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  headers = compileHeaders(parsed.manifest, { hostOrigins: [origin] })
  return { server, origin }
}

// --- the browser runs -----------------------------------------------------------------------------------------

interface PageRun {
  readonly page: string
  readonly ready: boolean
  readonly report: Record<string, unknown> | null
  readonly violations: readonly { directive: string; blocked: string; sample: string }[]
  readonly consoleErrors: readonly string[]
  readonly cspConsole: readonly string[]
  readonly loadedGzip: number
  readonly image?: { readonly distinctColours: number; readonly notBackground: number } | undefined
}

/** Distinct colours and the share of pixels that are not the clear colour (0x2e222f), from a screenshot. */
function imageStats(png: Buffer) {
  const image = PNG.sync.read(png)
  const colours = new Set<number>()
  let notBackground = 0
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i]!
    const g = image.data[i + 1]!
    const b = image.data[i + 2]!
    colours.add((r << 16) | (g << 8) | b)
    if (Math.abs(r - 0x2e) + Math.abs(g - 0x22) + Math.abs(b - 0x2f) > 12) notBackground++
  }
  return { distinctColours: colours.size, notBackground: notBackground / (image.width * image.height) }
}

async function runPage(browser: Browser, origin: string, page: string, shoot: boolean): Promise<PageRun> {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const tab = await context.newPage()
  await tab.addInitScript(() => {
    const seen: { directive: string; blocked: string; sample: string }[] = []
    ;(window as unknown as { __csp: typeof seen }).__csp = seen
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push({ directive: event.violatedDirective, blocked: event.blockedURI, sample: event.sample })
    })
  })
  const consoleErrors: string[] = []
  const cspConsole: string[] = []
  tab.on('console', (message) => {
    const text = message.text()
    if (/content[- ]security[- ]policy|unsafe-eval|refused to/i.test(text)) cspConsole.push(text)
    if (message.type() === 'error') consoleErrors.push(text)
  })
  tab.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))
  const loaded: Promise<number>[] = []
  tab.on('response', (response) => {
    if (/\.(js|css)$/.test(new URL(response.url()).pathname)) {
      loaded.push(
        response.body().then(
          (body) => gzipSync(body, { level: 9 }).length,
          () => 0,
        ),
      )
    }
  })
  await tab.goto(`${origin}/${page}`)
  let ready = false
  try {
    await tab.waitForFunction(
      () => (window as unknown as { __s7?: { ready: boolean } }).__s7?.ready === true,
      null,
      {
        timeout: Number(process.env.S7_TIMEOUT ?? 90_000),
      },
    )
    ready = true
  } catch {
    ready = false
  }
  const report = (await tab.evaluate(() => (window as unknown as { __s7?: unknown }).__s7 ?? null)) as Record<
    string,
    unknown
  > | null
  const violations = await tab.evaluate(() => (window as unknown as { __csp: [] }).__csp)
  const image = shoot ? imageStats(await tab.screenshot()) : undefined
  if (shoot)
    writeFileSync(
      join(out, `${page.replace('.html', '')}-${browser.browserType().name()}.png`),
      await tab.screenshot(),
    )
  const loadedGzip = (await Promise.all(loaded)).reduce((a, b) => a + b, 0)
  await context.close()
  return { page, ready, report, violations, consoleErrors, cspConsole, loadedGzip, image }
}

async function main(): Promise<void> {
  mkdirSync(out, { recursive: true })
  const builds = { standard: viteBuild('standard'), webglOnly: viteBuild('webgl-only', 'webgl-only') }

  const bytes = {
    scene: entryBytes(builds.standard, 'index.html'),
    sceneWithRemedy: entryBytes(builds.standard, 'index-shim.html'),
    sceneWebglOnly: entryBytes(builds.webglOnly, 'index.html'),
    no3d: entryBytes(builds.standard, 'no3d.html'),
  }
  const extrasGuard = {
    scene: findExtras(builds.standard.dir).filter((hit) => !hit.file.includes('extras-')),
    extrasPage: findExtras(builds.standard.dir).filter((hit) => hit.file.includes('extras-')),
  }

  const { server, origin } = await serve(builds.standard)
  const engines: readonly BrowserType[] = [chromium, webkit, firefox].filter(
    (engine) => !process.env.S7_ENGINES || process.env.S7_ENGINES.split(',').includes(engine.name()),
  )
  const runs: Record<string, { version: string; pages: PageRun[] }> = {}
  for (const engine of engines) {
    const browser = await engine.launch()
    const pages: PageRun[] = []
    pages.push(await runPage(browser, origin, 'index.html', true))
    pages.push(await runPage(browser, origin, 'index-shim.html', true))
    pages.push(await runPage(browser, origin, 'no3d.html', false))
    pages.push(await runPage(browser, origin, 'extras.html', false))
    runs[engine.name()] = { version: browser.version(), pages }
    await browser.close()
  }
  server.close()

  const results = { date: new Date().toISOString(), node: process.version, bytes, extrasGuard, runs }
  writeFileSync(join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)

  const kb = (n: number) => `${(n / 1024).toFixed(1)} kB`
  console.log('\n| Build | Up front (gzip) | Lazy chunks (gzip) | Total (gzip) |\n|---|---|---|---|')
  for (const [name, b] of Object.entries(bytes))
    console.log(`| ${name} | ${kb(b.upfront)} | ${kb(b.lazy)} | ${kb(b.all)} |`)
  console.log(
    '\n| Browser | Page | Ready | Renderer | GPU | CSP events | CSP console | Console errors | Loaded (gzip) | Colours | Not background |',
  )
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const [name, run] of Object.entries(runs)) {
    for (const page of run.pages) {
      const report = page.report ?? {}
      console.log(
        `| ${name} ${run.version} | ${page.page} | ${page.ready} | ${String(report.renderer ?? '')} | ${String(report.gpu ?? '')} | ${page.violations.length} | ${page.cspConsole.length} | ${page.consoleErrors.length} | ${kb(page.loadedGzip)} | ${page.image?.distinctColours ?? ''} | ${page.image ? page.image.notBackground.toFixed(3) : ''} |`,
      )
    }
  }
  for (const [name, run] of Object.entries(runs)) {
    for (const page of run.pages) {
      for (const text of [...page.consoleErrors, ...page.cspConsole])
        console.log(`${name} ${page.page}: ${text.slice(0, 300)}`)
      for (const v of page.violations) console.log(`${name} ${page.page}: violation ${JSON.stringify(v)}`)
    }
  }
  console.log(`\nresults: ${join(out, 'results.json')}`)
}

await main()
