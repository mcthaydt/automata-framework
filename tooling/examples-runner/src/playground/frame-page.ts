import { escapeHtml, PAGE_STYLE, pendingPage } from '../page-template.ts'
import { framePolicy } from './frame-policy.ts'

/** The site paths of one playground runtime build (website playground spec §5.5). */
export interface PlaygroundRuntime {
  readonly automata: string
  readonly zod: string
  readonly frame: string
  readonly styles: readonly string[]
}

/**
 * The page a playground frame loads for one example (website playground spec §5.3), served from `siteOrigin`. Its
 * one inline script is the import map that points the examples' two bare imports at the runtime; the policy carries
 * that map's hash. The frame script imports no-eval first, then waits for its parent's `run`. A pending example gets
 * the runner's pending page, which runs nothing.
 */
export function playgroundFramePage(
  entry: { readonly id: string; readonly title: string; readonly pending?: string | undefined },
  runtime: PlaygroundRuntime,
  siteOrigin: string,
): string {
  if (entry.pending !== undefined) return pendingPage({ id: entry.id, pending: entry.pending })
  const importMap = JSON.stringify({ imports: { '@mcthaydt/automata': runtime.automata, zod: runtime.zod } })
  const styles = runtime.styles
    .map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" crossorigin="anonymous" />\n`)
    .join('')
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
  <body>
    <main id="game"></main>
    <script type="module" src="${escapeHtml(runtime.frame)}"></script>
  </body>
</html>
`
}
