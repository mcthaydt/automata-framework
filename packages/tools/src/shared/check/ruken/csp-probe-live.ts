import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileHeaders } from '@ruken/manifest'
import { Effect, Layer } from 'effect'
import type { ShipConfig } from '../../ship/config/ship-config.ts'
import { checkManifest } from '../../ship/targets/ruken/check-manifest.ts'
import { rukenToml } from '../../ship/targets/ruken/ruken-toml.ts'
import { CheckToolError, CspProbe, type CspProbeResult } from '../csp-probe.ts'

// The live `csp` step (DX spec §3.6): serve `dist/` with the headers Ruken would serve this game with, open it
// in Chromium, and wait for the runtime's ready signal (`<html data-state="ready">`, set by
// `packages/runtime` page layers and emberwick's boot page) or `failed`. Every `securitypolicyviolation` the page
// fires is a finding, including one the game catches (a blocked `eval` in a try block still fires the event).
//
// Playwright is the game's own dependency, resolved from the game folder (`playwright`, else
// `@playwright/test`), so the CLI does not ship a browser driver. Missing Playwright or Chromium is a missing
// tool (exit 2), never a pass.

/** Ruken's headers for this game: `compileHeaders` on its manifest, for Ruken's local host origins. */
export function headersFor(config: ShipConfig): Effect.Effect<Record<string, string>, CheckToolError> {
  return Effect.map(
    Effect.mapError(
      checkManifest(rukenToml(config)),
      (error) => new CheckToolError({ kind: 'failed', tool: 'ship.config.ts', detail: error.message }),
    ),
    (manifest) => compileHeaders(manifest, 'local'),
  )
}

const loadShipConfig = (gameDir: string): Effect.Effect<ShipConfig, CheckToolError> =>
  Effect.tryPromise({
    try: async () => {
      const module = (await import(pathToFileURL(join(gameDir, 'ship.config.ts')).href)) as {
        default: ShipConfig
      }
      return module.default
    },
    catch: (cause) =>
      new CheckToolError({
        kind: 'failed',
        tool: 'ship.config.ts',
        detail: `cannot load the game's ship.config.ts (the manifest the CSP comes from): ${String(cause)}`,
      }),
  })

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

export interface DistServer {
  /** `http://127.0.0.1:<port>/`, ending in `/`. */
  readonly url: string
  close(): Promise<void>
}

/** A static server for `distDir` on an ephemeral port; every response carries `headers`. */
export function serveDist(distDir: string, headers: Readonly<Record<string, string>>): Promise<DistServer> {
  const root = resolve(distDir)
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    const file = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`)
    // Never serve outside dist (a `..` path).
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404, headers).end()
      return
    }
    response.writeHead(200, {
      ...headers,
      'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    })
    createReadStream(file).pipe(response)
  })
  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      done({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((closed) => server.close(() => closed())),
      })
    })
  })
}

/** The few Playwright calls the probe makes; the CLI does not depend on Playwright's types. */
interface PlaywrightPage {
  addInitScript(script: string): Promise<void>
  goto(url: string): Promise<unknown>
  waitForSelector(selector: string, options: { state: 'attached'; timeout: number }): Promise<unknown>
  evaluate<T>(fn: string): Promise<T>
}
interface PlaywrightBrowser {
  newPage(): Promise<PlaywrightPage>
  close(): Promise<void>
}
interface Playwright {
  readonly chromium: { launch(options: { headless: boolean }): Promise<PlaywrightBrowser> }
}

const INSTALL_PLAYWRIGHT = 'install it: npm install --save-dev playwright && npx playwright install chromium'

/**
 * The folder whose `node_modules` holds `name`, from `start` upwards. Only the game's own `node_modules` count:
 * Node's global folders (NODE_PATH) are never used, so a Playwright installed elsewhere cannot stand in for it.
 */
function packageHome(start: string, name: string): string | undefined {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

const loadPlaywright = (resolveFrom: string): Effect.Effect<Playwright, CheckToolError> =>
  Effect.tryPromise({
    try: async () => {
      for (const name of ['playwright', '@playwright/test']) {
        const home = packageHome(resolveFrom, name)
        if (home === undefined) continue
        const entry = createRequire(join(home, 'package.json')).resolve(name)
        const module = (await import(pathToFileURL(entry).href)) as Partial<Playwright> & {
          default?: Playwright
        }
        const playwright = module.chromium === undefined ? module.default : (module as Playwright)
        if (playwright?.chromium !== undefined) return playwright
      }
      throw new Error('not found')
    },
    catch: () => new CheckToolError({ kind: 'missing', tool: 'playwright', detail: INSTALL_PLAYWRIGHT }),
  })

// Runs before the game's own scripts and keeps every violation the page reports.
const COLLECT_VIOLATIONS = `
  window.__automataCspViolations = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    window.__automataCspViolations.push(event.violatedDirective + ' blocked ' + (event.blockedURI || 'inline'));
  });
`
// A selector wait runs in Playwright's own utility world. A string `waitForFunction` would be compiled in the
// page, and the page's CSP blocks that and reports it as a violation of the game's.
const READY_OR_FAILED = 'html[data-state="ready"], html[data-state="failed"]'

export interface ProbeDistInput {
  readonly distDir: string
  readonly headers: Readonly<Record<string, string>>
  readonly timeoutMs: number
  /** The folder Playwright is resolved from: the game folder. */
  readonly resolveFrom: string
}

export function probeDist(input: ProbeDistInput): Effect.Effect<CspProbeResult, CheckToolError> {
  return Effect.gen(function* () {
    if (!existsSync(join(input.distDir, 'index.html'))) {
      return yield* new CheckToolError({
        kind: 'failed',
        tool: 'csp',
        detail: `no ${input.distDir}/index.html to serve`,
      })
    }
    const playwright = yield* loadPlaywright(input.resolveFrom)
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const server = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: () => serveDist(input.distDir, input.headers),
            catch: (cause) =>
              new CheckToolError({
                kind: 'failed',
                tool: 'csp',
                detail: `cannot serve dist: ${String(cause)}`,
              }),
          }),
          (s) => Effect.promise(() => s.close()),
        )
        const browser = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: () => playwright.chromium.launch({ headless: true }),
            catch: (cause) =>
              new CheckToolError({
                kind: 'missing',
                tool: 'chromium',
                detail: `Playwright could not start Chromium (${String(cause).split('\n')[0]}); run npx playwright install chromium`,
              }),
          }),
          (b) => Effect.promise(() => b.close()),
        )
        return yield* Effect.tryPromise({
          try: async () => {
            const page = await browser.newPage()
            await page.addInitScript(COLLECT_VIOLATIONS)
            await page.goto(server.url)
            const ready = await page
              .waitForSelector(READY_OR_FAILED, { state: 'attached', timeout: input.timeoutMs })
              .then(() => true)
              .catch(() => false)
            const state = await page.evaluate<string | undefined>('document.documentElement.dataset.state')
            const violations = await page.evaluate<string[]>('window.__automataCspViolations ?? []')
            return { ready: ready && state === 'ready', state: state ?? undefined, violations }
          },
          catch: (cause) => new CheckToolError({ kind: 'failed', tool: 'csp', detail: String(cause) }),
        })
      }),
    )
  })
}

export const CspProbeLive: Layer.Layer<CspProbe> = Layer.succeed(CspProbe, {
  run: (input) =>
    Effect.gen(function* () {
      const config = yield* loadShipConfig(input.gameDir)
      const headers = yield* headersFor(config)
      return yield* probeDist({ ...input, headers, resolveFrom: input.gameDir })
    }),
})
