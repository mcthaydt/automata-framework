// A built page's JavaScript: hydration waits for the first paint, the Content-Security-Policy allows exactly the
// inline scripts the page has, and the preloaded modules, the editor and the compile worker stay within their budgets.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { CSP_META_PREFIX, scriptHash } from '../../src/shared/html/csp.ts'
import { builtPages, isOtherOrigin, pageUrl } from './pages.ts'

/**
 * The most JavaScript, as built (before compression), that one page may ask the browser to modulepreload.
 * Preloaded modules start downloading before any script has run, so on a mobile connection they compete with the
 * stylesheet, font and image the first paint waits for. The home page and the gallery once preloaded 380 KB of example
 * sources and had a 3.2 s LCP; then the 26 to 29 hints for shared chunks (250 KB) cost every page 0.5 to 0.9 s of first
 * paint. Only the entry and node modules are preloaded now (`src/shared/html/preloads.ts`); the heaviest page has 35 KB of them,
 * which this leaves room for. Raise it only with a Lighthouse run that still meets the LCP budget.
 */
export const MAX_PRELOADED_SCRIPT_BYTES = 48_000

/** The folders whose modules a page may preload: the app's entry points and the page's own nodes, not shared chunks. */
const PRELOADABLE_MODULES = /^_app\/immutable\/(?:entry|nodes)\//

/**
 * A page that hydrates starts after the first paint. SvelteKit's start script imports about 30 small modules and
 * hydrates at once; on a host that finishes those requests before it paints, Lighthouse charges all of them (350 KB) to
 * the first paint. `hydrateAfterFirstPaint` (src/shared/html/hydration.ts, applied in src/hooks.server.ts) wraps the imports in
 * `afterFirstPaint(`; a page that imports its entry modules without it was not transformed (a SvelteKit upgrade can
 * change the script's shape, and the transform then leaves it alone).
 */
export function checkHydrationStart(file: string, html: string): string[] {
  const hydrates = /import\("[^"]*\/entry\/start\.[^"]*"\)/.test(html)
  if (!hydrates || html.includes('afterFirstPaint(() =>')) return []
  return [
    `${file}: starts hydrating at once; the start script must wait for the first paint (hydrateAfterFirstPaint in src/hooks.server.ts), because a host that finishes the module requests before painting charges all of them to the first paint`,
  ]
}

/**
 * Every page carries its Content-Security-Policy first in <head>: a `<meta>` policy applies only to what comes
 * after it. Its script-src allows each inline script by the sha256 of its text and never `unsafe-inline` or
 * `unsafe-eval`; a script rewritten after the policy was written would be refused by the browser.
 */
export function checkContentSecurityPolicy(file: string, html: string, doc: Document): string[] {
  const head = /<head(?:\s[^>]*)?>/.exec(html)
  const metaAt = head ? head.index + head[0].length : -1
  if (!head || !html.startsWith(CSP_META_PREFIX, metaAt)) {
    return [
      `${file}: has no Content-Security-Policy first in <head> (withContentSecurityPolicy, applied last in src/shared/html/finish-page.ts)`,
    ]
  }
  const start = metaAt + CSP_META_PREFIX.length
  const policy = html.slice(start, html.indexOf('"', start))
  const scriptSrc =
    policy
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('script-src ')) ?? ''
  const failures: string[] = []
  if (/'unsafe-(inline|eval)'/.test(scriptSrc))
    failures.push(
      `${file}: script-src allows unsafe-inline or unsafe-eval; the quality bar (QB.4) forbids both for scripts`,
    )
  const allowed = new Set(scriptSrc.split(/\s+/))
  // Hashed from the parsed page, not with csp.ts's own reading of the HTML, so a script the hook misread is caught.
  const inline = Array.from(doc.querySelectorAll('script:not([src])'), (script) =>
    scriptHash(script.textContent ?? ''),
  )
  if (inline.some((hash) => !allowed.has(hash))) {
    failures.push(
      `${file}: an inline script is not allowed by the page’s Content-Security-Policy (its sha256 is not in script-src), so the browser will refuse to run it`,
    )
  }
  return failures
}

/** A page's modulepreload links exist in the build, are entry or node modules, and together stay within MAX_PRELOADED_SCRIPT_BYTES. */
export function checkPreloadedScripts(root: string, file: string, doc: Document): string[] {
  const failures: string[] = []
  const modules: { path: string; bytes: number }[] = []
  for (const link of doc.querySelectorAll('link[rel~="modulepreload"][href]')) {
    const href = link.getAttribute('href')!
    if (isOtherOrigin(href)) continue
    const path = new URL(href, pageUrl(file)).pathname.slice(1)
    if (!existsSync(join(root, path)))
      failures.push(`${file}: modulepreloads ${href}, which the build does not contain`)
    else if (!PRELOADABLE_MODULES.test(path))
      failures.push(
        `${file}: modulepreloads ${path}, a shared chunk; only the entry and node modules may be preloaded, because hints for chunks delay the first paint on a mobile connection`,
      )
    else modules.push({ path, bytes: statSync(join(root, path)).size })
  }
  const total = modules.reduce((sum, module) => sum + module.bytes, 0)
  if (total > MAX_PRELOADED_SCRIPT_BYTES) {
    const largest = modules.reduce((a, b) => (b.bytes > a.bytes ? b : a))
    failures.push(
      `${file}: modulepreloads ${total} bytes of JavaScript, over the ${MAX_PRELOADED_SCRIPT_BYTES} byte budget (largest: ${largest.path}, ${largest.bytes} bytes)`,
    )
  }
  return failures
}

/** The editor's source, as the build's Vite manifest keys it. */
export const EDITOR_SOURCE = 'src/features/playground/editor.ts'
/** The editor chunk and the chunks it imports, gzipped. */
export const MAX_EDITOR_CHUNK_GZIP_BYTES = 175_000

interface ManifestChunk {
  readonly file: string
  readonly imports?: readonly string[]
}

/**
 * The editor loads on the first tap or focus on an example's code, so no page may name its chunk or the
 * chunks it imports, and together they stay within MAX_EDITOR_CHUNK_GZIP_BYTES. `manifest` is the build's
 * `.vite/manifest.json`, which maps the editor's source to its file.
 */
export function checkEditorChunk(
  root: string,
  manifest: Record<string, ManifestChunk>,
): { failures: string[]; gzipBytes: number } {
  if (!manifest[EDITOR_SOURCE])
    return { failures: [`the build's manifest has no ${EDITOR_SOURCE}`], gzipBytes: 0 }
  const files = new Set<string>()
  const visit = (key: string) => {
    const chunk = manifest[key]
    if (!chunk || files.has(chunk.file)) return
    files.add(chunk.file)
    for (const imported of chunk.imports ?? []) visit(imported)
  }
  visit(EDITOR_SOURCE)
  const failures: string[] = []
  const gzipBytes = [...files].reduce(
    (sum, file) => sum + gzipSync(readFileSync(join(root, file)), { level: 9 }).length,
    0,
  )
  if (gzipBytes > MAX_EDITOR_CHUNK_GZIP_BYTES)
    failures.push(
      `the editor chunk and its imports are ${gzipBytes} bytes gzip, over the ${MAX_EDITOR_CHUNK_GZIP_BYTES} byte budget`,
    )
  for (const page of builtPages(root)) {
    const html = readFileSync(join(root, page), 'utf8')
    for (const file of files)
      if (html.includes(file))
        failures.push(
          `${page}: names ${file}, part of the editor, which loads only on a tap or focus on the code`,
        )
  }
  return { failures, gzipBytes }
}

/** The compile worker's gzip budget: `@babel/parser` and sucrase. */
export const MAX_COMPILE_WORKER_GZIP_BYTES = 125_000
const WORKERS_DIR = '_app/immutable/workers'

/**
 * The compile worker starts with the editor, so no page names it, and it stays within
 * MAX_COMPILE_WORKER_GZIP_BYTES. Vite emits a worker under `_app/immutable/workers/` and leaves it out of the manifest,
 * so it is found by its name.
 */
export function checkCompileWorker(root: string): { failures: string[]; gzipBytes: number } {
  const dir = join(root, WORKERS_DIR)
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => /^compile\.worker-[\w-]+\.js$/.test(name))
        .map((name) => `${WORKERS_DIR}/${name}`)
    : []
  if (files.length === 0)
    return { failures: [`the build has no compile worker under ${WORKERS_DIR}/`], gzipBytes: 0 }
  const failures: string[] = []
  const gzipBytes = Math.max(
    ...files.map((file) => gzipSync(readFileSync(join(root, file)), { level: 9 }).length),
  )
  if (gzipBytes > MAX_COMPILE_WORKER_GZIP_BYTES)
    failures.push(
      `the compile worker is ${gzipBytes} bytes gzip, over the ${MAX_COMPILE_WORKER_GZIP_BYTES} byte budget`,
    )
  for (const page of builtPages(root)) {
    const html = readFileSync(join(root, page), 'utf8')
    for (const file of files)
      if (html.includes(file))
        failures.push(`${page}: names ${file}, the compile worker, which starts only with the editor`)
  }
  return { failures, gzipBytes }
}
