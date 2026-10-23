// The files Ruken fetches before the game starts (`[loading] preload`, Ruken M2.1g), worked out after a
// build. Generalized from FloorFifty deploy/tools/ruken-pack.ts `preloadFor` (122a220): FloorFifty listed
// its splash bundles and fonts in code; here the game names screens in `game.toml` (`preload_screens`,
// default the flow's entry) and each screen's files in `assets.toml`.
//
// Inside Ruken the player then waits once, behind Ruken's cover with its progress, and the game's own
// loader finds the files in the browser's cache. A file that is not in the build would stop Ruken's own
// check, so every missing one is reported here first, all at once.

import { join } from 'node:path'
import { Effect } from 'effect'
import { type ContentOptions, compileContent } from '../compile/compile-content'
import { ContentCompileFailed, type InvalidContentConfig } from '../compile/errors'
import { type Diagnostic, sortDiagnostics } from '../diagnostics/diagnostic'
import { pathKind, readTextIfPresent } from '../files/content-files'
import type { FlowGraph } from '../flow/check-flow'
import type { AssetsSource, GameSource } from '../game/game-facts'
import { locateKeys, positionOf } from '../parse/locate-keys'

/**
 * What `preloadList` reads: the content options (to compile `game.toml` and `assets.toml`) and the built game
 * folder.
 */
export interface PreloadInput {
  readonly options: ContentOptions
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string
}

interface Entry {
  readonly file: string
  readonly path: readonly (string | number)[]
}

/** The files of each preload screen, in order; a file listed twice keeps its first place. */
function preloadEntries(
  game: GameSource,
  assets: AssetsSource | undefined,
  flow: FlowGraph | undefined,
): Entry[] {
  const screens = game.preload_screens ?? (flow === undefined ? [] : [flow.entry])
  const seen = new Set<string>()
  const entries: Entry[] = []
  for (const screen of screens) {
    assets?.screens[screen]?.files.forEach((file, index) => {
      if (seen.has(file)) return
      seen.add(file)
      entries.push({ file, path: ['screens', screen, 'files', index] })
    })
  }
  return entries
}

/**
 * The files Ruken preloads before the game starts, in order, for `[loading] preload`: each `preload_screens`
 * screen's files from `assets.toml` (the flow's entry when none is named), without repeats. Empty without a
 * `game.toml`. Fails with `ContentCompileFailed` carrying a `missingAsset` diagnostic for every file the
 * build lacks, all at once, or with `InvalidContentConfig`.
 */
export const preloadList = (
  input: PreloadInput,
): Effect.Effect<string[], ContentCompileFailed | InvalidContentConfig> =>
  Effect.gen(function* () {
    const { data } = yield* compileContent(input.options)
    const game = data.game as GameSource | undefined
    if (game === undefined) return []
    const entries = preloadEntries(
      game,
      data.assets as AssetsSource | undefined,
      data.flow as FlowGraph | undefined,
    )

    const missing: { entry: Entry; message: string }[] = []
    for (const entry of entries) {
      // `dir/*` names every file in a folder (Ruken's rule), so the folder itself must exist.
      const folder = entry.file.endsWith('/*') ? entry.file.slice(0, -2) : undefined
      const kind = yield* pathKind(join(input.distDir, folder ?? entry.file)).pipe(
        Effect.orElseSucceed(() => undefined),
      )
      if (folder !== undefined && kind !== 'folder') {
        missing.push({ entry, message: `${entry.file} needs the folder ${folder} in the build` })
      } else if (folder === undefined && kind !== 'file') {
        missing.push({ entry, message: `${entry.file} is not in the build` })
      }
    }
    if (missing.length === 0) return entries.map((entry) => entry.file)

    // Place each missing file at its line in assets.toml, which compiled cleanly a moment ago.
    const text = yield* readTextIfPresent(join(input.options.root, 'content/assets.toml')).pipe(
      Effect.orElseSucceed(() => undefined),
    )
    const keys = locateKeys(text ?? '')
    const diagnostics: Diagnostic[] = missing.map(({ entry, message }) => {
      const segments = entry.path.map((segment) => (typeof segment === 'number' ? segment : String(segment)))
      const { line, column } = positionOf(keys, segments)
      return {
        code: 'missingAsset',
        file: 'content/assets.toml',
        line,
        column,
        keyPath: segments.join('.'),
        message,
      }
    })
    return yield* new ContentCompileFailed({ diagnostics: sortDiagnostics(diagnostics) })
  })
