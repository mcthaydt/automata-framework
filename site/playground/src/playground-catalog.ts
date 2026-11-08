import { type CatalogEntry, isUnpublishedExtension } from '@mcthaydt/examples-runner/catalog'
import type { HostSettings } from '@mcthaydt/examples-runner/header'
import { exampleModulePath } from '../../src/lib/playground/protocol.ts'

/** One example as the site shows it (`catalog.json`). */
export interface PlaygroundExample {
  readonly id: string
  readonly module: string
  readonly name: string
  readonly title: string
  readonly shows: string
  readonly controls: string
  readonly packages: readonly string[]
  readonly difficulty: 1 | 2 | 3 | 4
  readonly tier: 'core' | 'plus'
  /** The golden the frame replays for the unedited code. */
  readonly golden?: { readonly ticks: number; readonly replay: string }
  readonly host?: HostSettings
  /** The open tasks a pending example waits for; its frame page runs nothing. */
  readonly pending?: string
  /** `<module>/<module>-<name>.png`, when the Owner approved one. */
  readonly screenshot?: string
  /** From the examples folder. */
  readonly path: string
  /** The file as written, header included: what the editor starts from and Reset restores. */
  readonly source: string
  readonly codeLines: number
  readonly framePage: string
  /** What the compile step writes for `import.meta.url`, under the site's origin. */
  readonly moduleUrl: string
}

/**
 * The site's example data from the runner's catalog: valid examples only, sorted by id. An example of an
 * unpublished extension is left out: the site is public, and that extension is not (D-1).
 */
export function playgroundCatalog(
  entries: readonly CatalogEntry[],
  readSource: (entry: CatalogEntry) => string,
): PlaygroundExample[] {
  return entries
    .filter((entry) => entry.header !== undefined && entry.problems.length === 0)
    .filter((entry) => !entry.imports.some(isUnpublishedExtension))
    .map((entry) => {
      const header = entry.header as NonNullable<CatalogEntry['header']>
      return {
        id: entry.id,
        module: entry.module,
        name: entry.name,
        title: header.title,
        shows: header.shows,
        controls: header.controls,
        packages: header.packages,
        difficulty: header.difficulty,
        tier: header.tier,
        ...(header.golden === undefined
          ? {}
          : { golden: { ticks: header.golden, replay: `/playground/goldens/${entry.id}.replay` } }),
        ...(header.host === undefined ? {} : { host: header.host }),
        ...(header.pending === undefined ? {} : { pending: header.pending }),
        ...(entry.screenshot === undefined ? {} : { screenshot: entry.screenshot }),
        path: entry.path,
        source: readSource(entry),
        codeLines: entry.codeLines,
        framePage: `/playground/examples/${entry.module}/${entry.name}/`,
        moduleUrl: exampleModulePath(entry.module, entry.name),
      }
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
