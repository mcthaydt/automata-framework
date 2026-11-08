import type { HostSettings } from '@mcthaydt/examples-runner/header'
import { escapeHtml, PAGE_STYLE, pendingPage } from '@mcthaydt/examples-runner/page-template'
import { framePolicy } from './ruken/frame-policy.ts'

/** The site paths of one playground runtime build. */
export interface PlaygroundRuntime {
  readonly automata: string
  readonly zod: string
  /** Runs no-eval before any other runtime chunk evaluates (R-6). */
  readonly noEval: string
  readonly frame: string
  readonly styles: readonly string[]
}

/**
 * The page a playground frame loads for one example, served from `siteOrigin`. Its
 * one inline script is the import map that points the examples' two bare imports at the runtime; the policy carries
 * that map's hash. The frame script imports no-eval first, then waits for its parent's `run`. The body says which
 * file the example is (stack frames name it through the compile step's sourceURL) and its `Host:` settings, as data
 * attributes the frame parses. A pending example gets the runner's pending page, which runs nothing.
 */
export function playgroundFramePage(
  entry: {
    readonly id: string
    readonly title: string
    /** From the examples folder: `<module>/<module>-<name>.ts`. */
    readonly path: string
    readonly host?: HostSettings | undefined
    readonly pending?: string | undefined
  },
  runtime: PlaygroundRuntime,
  siteOrigin: string,
): string {
  if (entry.pending !== undefined) return pendingPage({ id: entry.id, pending: entry.pending })
  const importMap = JSON.stringify({ imports: { '@mcthaydt/automata': runtime.automata, zod: runtime.zod } })
  const styles = runtime.styles
    .map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" crossorigin="anonymous" />\n`)
    .join('')
  const host = entry.host === undefined ? '' : ` data-host="${escapeHtml(JSON.stringify(entry.host))}"`
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${escapeHtml(framePolicy(importMap, siteOrigin))}" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(`${entry.id}: ${entry.title} (preview)`)}</title>
    <style>
      ${PAGE_STYLE}
    </style>
    <script type="importmap">${importMap}</script>
${styles}  </head>
  <body data-example="${escapeHtml(`examples/${entry.path}`)}"${host}>
    <main id="game"></main>
    <script type="module" src="${escapeHtml(runtime.noEval)}"></script>
    <script type="module" src="${escapeHtml(runtime.frame)}"></script>
  </body>
</html>
`
}
