// What the parity test and the runner's stub read from an example's default export (EX spec §4). DX.2's
// `defineGame` settles the real shape; until then this is the part the golden replay needs.
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'
import { parseHeader } from './header.ts'

export interface GoldenExample {
  readonly id: string
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    /** Spawns before tick 0. */
    readonly setup?: (sim: Sim) => void
  }
}

export interface GoldenEntry {
  readonly id: string
  readonly ticks: number
  /** The `.replay`, relative to the parity test file. */
  readonly replay: string
  readonly load: () => Promise<GoldenExample>
}

const EXAMPLE_FILE = /\/([a-z0-9]+)\/(\1-[a-z0-9-]+)\.ts$/

/**
 * The examples that declare `Golden:` and are not pending, from `import.meta.glob` results (file path to source,
 * and file path to a lazy import), so it runs where there is no file system. A pending example is never imported.
 */
export function goldenExamples(
  { sources }: { readonly sources: Readonly<Record<string, unknown>> },
  { modules }: { readonly modules: Readonly<Record<string, () => Promise<unknown>>> },
  goldensDir: string,
): GoldenEntry[] {
  const entries: GoldenEntry[] = []
  for (const path of Object.keys(sources).sort()) {
    const id = EXAMPLE_FILE.exec(path)?.[2]
    const header = parseHeader(String(sources[path]))
    const load = modules[path]
    if (id === undefined || Array.isArray(header) || load === undefined) continue
    if (header.golden === undefined || header.pending !== undefined) continue
    entries.push({
      id,
      ticks: header.golden,
      replay: `${goldensDir}/${id}.replay`,
      load: async () => (await load()) as GoldenExample,
    })
  }
  return entries
}
