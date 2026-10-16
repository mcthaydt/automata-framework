// The examples runner (EX spec §5): one Vite plugin serves and builds every `<module>/<module>-<name>.ts` under
// the examples folder at `/<module>/<name>/`, from one generated page, with Ruken's headers in dev and preview so an
// example that breaks under Ruken's CSP fails its smoke test. Pending examples are listed, never built.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { defineShipConfig } from '@mcthaydt/automata-ship'
import type { Plugin } from 'vite'
import { previewHeaders } from '../host/preview-headers.ts'
import { type CatalogEntry, type CatalogOptions, readCatalog } from './catalog.ts'
import { examplePage, indexPage, type PageModules, pendingPage } from './page-template.ts'

export interface ExamplesRunnerOptions {
  /** The examples folder. */
  readonly root: string
  /** The module exporting `startGame` (default `@mcthaydt/automata`, DX.2 and PRODUCT.2). */
  readonly start?: string
  /** The side-effect import every page runs first (default `@mcthaydt/automata-render-pixi/no-eval`). */
  readonly noEval?: string
  readonly catalog?: CatalogOptions
}

/**
 * The manifest every example is served under: examples have no `ruken.toml` of their own (EX spec §5), so they all
 * share Ruken's headers for one 2D game, framable by the fake host.
 */
const EXAMPLES_SHIP_CONFIG = defineShipConfig({
  game: { id: 'af-examples', title: 'AF examples', version: '0.0.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['touch', 'keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

const isPending = (entry: CatalogEntry): boolean => entry.header?.pending !== undefined

export function examplesRunner(options: ExamplesRunnerOptions): Plugin {
  const modules: PageModules = {
    start: options.start ?? '@mcthaydt/automata',
    noEval: options.noEval ?? '@mcthaydt/automata-render-pixi/no-eval',
  }
  const headers = previewHeaders(EXAMPLES_SHIP_CONFIG)
  const catalog = () => readCatalog(options.root, options.catalog)
  const indexFile = join(options.root, 'index.html')
  const pageFile = (entry: CatalogEntry) => join(options.root, entry.module, entry.name, 'index.html')

  /** The generated HTML for a page file, or undefined when the file is not one of the runner's pages. */
  const pageFor = (file: string): string | undefined => {
    if (!file.endsWith('index.html')) return undefined // most ids: skip reading the catalog
    const entries = catalog()
    if (file === indexFile) return indexPage(entries)
    const entry = entries.find((candidate) => pageFile(candidate) === file)
    if (entry === undefined) return undefined
    const pending = entry.header?.pending
    if (pending !== undefined) return pendingPage({ id: entry.id, pending })
    return examplePage({ path: entry.path, id: entry.id, title: entry.header?.title ?? entry.id }, modules)
  }

  return {
    name: 'automata-examples-runner',
    config() {
      const input: Record<string, string> = { index: indexFile }
      for (const entry of catalog()) if (!isPending(entry)) input[entry.id] = pageFile(entry)
      return {
        root: options.root,
        base: './',
        appType: 'mpa',
        resolve: { conditions: ['browser'] },
        build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input } },
        preview: { headers },
      }
    },
    resolveId(source) {
      return pageFor(source) === undefined ? undefined : source
    },
    load(id) {
      return pageFor(id)
    },
    configureServer(server) {
      server.middlewares.use((request: IncomingMessage, response: ServerResponse, next: () => void) => {
        const path = (request.url ?? '/').split('?')[0] as string
        const file = path === '/' ? indexFile : join(options.root, path, 'index.html')
        const html = path === '/' || path.endsWith('/') ? pageFor(file) : undefined
        if (html === undefined) return next()
        // A pending page runs nothing, so it skips Vite's transform (which would add the dev client).
        const pending = catalog().some((entry) => isPending(entry) && pageFile(entry) === file)
        const send = (body: string) => {
          for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(body)
        }
        if (pending) return send(html)
        server.transformIndexHtml(path, html).then(send, (error: unknown) => {
          response.statusCode = 500
          response.end(String(error))
        })
      })
    },
  }
}
