// The HTML the runner generates (EX spec §5): one page per example and the index. No example has its own
// index.html; every page comes from here.
import { hostedQuery } from '../host/ports.ts'
import type { CatalogEntry } from './catalog.ts'

/** The game id every example is served under (the runner's one manifest, vite-plugin.ts). */
export const EXAMPLES_GAME_ID = 'af-examples'

export interface PageModules {
  /** The module that exports `startGame` (`@mcthaydt/automata`, or the runner's test stub). */
  readonly start: string
  /** Imported before anything else, so PixiJS never reaches for eval under Ruken's CSP (AGENTS.md). */
  readonly noEval: string
}

export const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

export const PAGE_STYLE = `html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; color: #eee; }
      body { font: 16px system-ui, sans-serif; }`

function page(title: string, body: string, style = PAGE_STYLE): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(title)}</title>
    <style>
      ${style}
    </style>
  </head>
  <body>
${body}
  </body>
</html>
`
}

/** The page that runs one example: its root `#game`, then no-eval, `startGame` and the example's default export. */
export function examplePage(
  entry: Pick<CatalogEntry, 'path' | 'id'> & { readonly title: string },
  modules: PageModules,
): string {
  return page(
    `${entry.id}: ${entry.title}`,
    `    <main id="game"></main>
    <script type="module">
      import '${modules.noEval}'
      import { startGame } from '${modules.start}'
      import example from '/${entry.path}'
      startGame(example)
    </script>`,
  )
}

/** A pending example's page: it says what it waits for and runs nothing (EX spec §7). */
export function pendingPage(entry: Pick<CatalogEntry, 'id'> & { readonly pending: string }): string {
  return page(
    `${entry.id}: pending`,
    `    <p>${escapeHtml(entry.id)} is pending: ${escapeHtml(entry.pending)}</p>`,
  )
}

/** One example's source, as written, for the viewer's second frame (EX.5). Static text: it runs nothing. */
export function sourcePage(entry: Pick<CatalogEntry, 'id'>, source: string): string {
  return page(
    `${entry.id}: source`,
    `    <pre><code>${escapeHtml(source)}</code></pre>`,
    `html, body { margin: 0; background: #111; color: #eee; }
      pre { margin: 0; padding: 16px; font: 14px/1.5 ui-monospace, monospace; }`,
  )
}

const stars = (difficulty: number): string => '★'.repeat(difficulty) + '☆'.repeat(4 - difficulty)

/**
 * The fake host around a runnable example, with its source framed beside it. The host needs absolute URLs and a
 * static build does not know its own origin, so `game` and `source` stay relative here and the index's script
 * resolves them against the page (INDEX_SCRIPT).
 */
function viewUrl(entry: CatalogEntry, hostOrigin: string): string {
  const query = hostedQuery(`.${entry.url}`, EXAMPLES_GAME_ID, {
    ...entry.header?.host,
    source: `.${entry.url}source/`,
  })
  return `${hostOrigin}/?${query}`
}

const INDEX_SCRIPT = `    <script type="module">
      for (const link of document.querySelectorAll('a[data-view]')) {
        const view = new URL(link.href)
        for (const key of ['game', 'source'])
          view.searchParams.set(key, new URL(view.searchParams.get(key), window.location.href).href)
        link.href = view.href
      }
    </script>`

function indexItem(entry: CatalogEntry, hostOrigin: string): string {
  const header = entry.header
  const pending = header?.pending
  const label = pending === undefined ? '' : ` <em>pending: ${escapeHtml(pending)}</em>`
  const shot =
    entry.screenshot === undefined
      ? ''
      : `\n          <img src="./${entry.screenshot}" alt="${escapeHtml(entry.id)}" width="320" />`
  // A pending example has nothing to run; its source still shows the API it waits for.
  const view =
    pending === undefined ? `<a data-view href="${escapeHtml(viewUrl(entry, hostOrigin))}">View</a> · ` : ''
  return `        <li data-example="${entry.id}">
          <a href=".${entry.url}">${escapeHtml(entry.id)}</a>: ${escapeHtml(header?.title ?? '')}${label}
          <br />${stars(header?.difficulty ?? 1)} · ${escapeHtml(header?.shows ?? '')} · Controls: ${escapeHtml(header?.controls ?? '')}${shot}
          <br />${view}<a href=".${entry.url}source/">Source</a>
        </li>`
}

/**
 * Every example grouped by module, with its header fields and approved screenshot. View opens the fake host with
 * the running example and its source beside it (`hostOrigin` serves the fake host, tooling/examples-runner/host).
 */
export function indexPage(entries: readonly CatalogEntry[], hostOrigin: string): string {
  const modules = [...new Set(entries.map((entry) => entry.module))]
  const sections = modules.map((module) => {
    const items = entries
      .filter((entry) => entry.module === module)
      .map((entry) => indexItem(entry, hostOrigin))
    return `    <section data-module="${escapeHtml(module)}">
      <h2>${escapeHtml(module)}</h2>
      <ul>
${items.join('\n')}
      </ul>
    </section>`
  })
  const body = sections.length > 0 ? sections.join('\n') : '    <p>No examples yet.</p>'
  return page(
    'AF examples',
    `    <h1>AF examples</h1>\n${body}\n${INDEX_SCRIPT}`,
    `html, body { margin: 0; background: #111; color: #eee; }
      body { font: 16px system-ui, sans-serif; padding: 16px; }
      img { display: block; max-width: 100%; height: auto; }
      a { color: #8cf; display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; }`,
  )
}
