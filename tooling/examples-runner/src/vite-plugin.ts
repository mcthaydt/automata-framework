// The examples runner (EX spec §5): one Vite plugin serves and builds every `<module>/<module>-<name>.ts` under
// the examples folder at `/<module>/<name>/`, from one generated page, with Ruken's headers in dev and preview so an
// example that breaks under Ruken's CSP fails its smoke test. Pending examples are listed, never built.
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { demoHostOrigin } from '../host/ports.ts'
import { previewHeaders } from '../host/preview-headers.ts'
import { type CatalogEntry, type CatalogOptions, readCatalog } from './catalog.ts'
import { EXAMPLES_SHIP_CONFIG } from './examples-ship-config.ts'
import { examplePage, indexPage, type PageModules, pendingPage, sourcePage } from './page-template.ts'

export interface ExamplesRunnerOptions {
  /** The examples folder. */
  readonly root: string
  /** The module exporting `startGame` (default `@mcthaydt/automata`, DX.2 and PRODUCT.2). */
  readonly start?: string
  /** The side-effect import every page runs first (default `@mcthaydt/automata/no-eval`). */
  readonly noEval?: string
  readonly catalog?: CatalogOptions
}

const isPending = (entry: CatalogEntry): boolean => entry.header?.pending !== undefined

export function examplesRunner(options: ExamplesRunnerOptions): Plugin {
  const modules: PageModules = {
    start: options.start ?? '@mcthaydt/automata',
    noEval: options.noEval ?? '@mcthaydt/automata/no-eval',
  }
  const headers = previewHeaders(EXAMPLES_SHIP_CONFIG)
  const catalog = () => readCatalog(options.root, options.catalog)
  const indexFile = join(options.root, 'index.html')
  const pageFile = (entry: CatalogEntry) => join(options.root, entry.module, entry.name, 'index.html')
  // Every example, pending ones too, has a source page beside its own: `/<module>/<name>/source/` (EX.5).
  const sourceFile = (entry: CatalogEntry) =>
    join(options.root, entry.module, entry.name, 'source', 'index.html')

  /** The generated HTML for a page file, or undefined when the file is not one of the runner's pages. */
  const pageFor = (file: string): string | undefined => {
    if (!file.endsWith('index.html')) return undefined // most ids: skip reading the catalog
    const entries = catalog()
    if (file === indexFile) return indexPage(entries, demoHostOrigin)
    const shown = entries.find((candidate) => sourceFile(candidate) === file)
    if (shown !== undefined) return sourcePage(shown, readFileSync(shown.file, 'utf8'))
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
      for (const entry of catalog()) {
        if (!isPending(entry)) input[entry.id] = pageFile(entry)
        input[`${entry.id}-source`] = sourceFile(entry)
      }
      return {
        root: options.root,
        base: './',
        appType: 'mpa',
        // The examples run in the fake Ruken host's frame: the Ruken adapter (DIST spec §5.3), then Svelte's client build.
        resolve: { conditions: ['automata-ruken', 'browser'] },
        // `assetsInlineLimit: 0`: Vite would inline an asset under 4 kB as a `data:` URL, which Pixi's loader fetches
        // and Ruken's CSP (`connect-src 'self'`) refuses; a same-origin file is what the CSP allows.
        build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0, rollupOptions: { input } },
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
        // A pending page and a source page run nothing, so they skip Vite's transform (which would add the dev
        // client).
        const runsNothing = catalog().some(
          (entry) => (isPending(entry) && pageFile(entry) === file) || sourceFile(entry) === file,
        )
        const send = (body: string) => {
          for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(body)
        }
        if (runsNothing) return send(html)
        server.transformIndexHtml(path, html).then(send, (error: unknown) => {
          response.statusCode = 500
          response.end(String(error))
        })
      })
    },
  }
}
