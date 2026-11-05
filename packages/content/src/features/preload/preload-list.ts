// The files Ruken fetches before the game starts (`[loading] preload`, Ruken M2.1g), worked out after a
// build. Generalized from FloorFifty deploy/tools/ruken-pack.ts `preloadFor` (122a220): FloorFifty listed
// its splash bundles and fonts in code; here the game names screens in `game.toml` (`preload_screens`,
// default the flow's entry) and each screen's files in `assets.toml`, with the atlases and fonts of the asset
// build it uses, whose pages and subsets join the list (M5 spec §4.7, M5.6F.2; `asset-build-files.ts`).
//
// Inside Ruken the player then waits once, behind Ruken's cover with its progress, and the game's own
// loader finds the files in the browser's cache. A file that is not in the build would stop Ruken's own
// check, so every missing one is reported here first, all at once.

import { join } from 'node:path'
import { Effect } from 'effect'
import { type ContentOptions, compileContent, outDirOf } from '../../shared/compile/compile-content'
import { ContentCompileFailed, type InvalidContentConfig } from '../../shared/compile/errors'
import {
  type DataPath,
  type Diagnostic,
  type Problem,
  sortDiagnostics,
} from '../../shared/diagnostics/diagnostic'
import { pathKind, readTextIfPresent } from '../../shared/files/content-files'
import type { FlowGraph } from '../../shared/flow/check-flow'
import type { AssetsSource, GameSource } from '../../shared/game/game-facts'
import { locateKeys, positionOf } from '../../shared/parse/locate-keys'
import { type AssetBuildFiles, readAssetBuildFiles } from './asset-build-files'

/**
 * What `preloadList` reads: the content options (to compile `game.toml` and `assets.toml`, and to find the asset
 * build's outputs below `outDir`) and the built game folder.
 */
export interface PreloadInput {
  readonly options: ContentOptions
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string
}

/** A file to preload, and the `assets.toml` key that brought it in. */
interface Entry {
  readonly file: string
  readonly path: DataPath
}

type PreloadScreen = AssetsSource['screens'][string] & { readonly id: string }

/** The preload screens that have an `assets.toml` entry, in order. */
function preloadScreens(game: GameSource, assets: AssetsSource | undefined, flow: FlowGraph | undefined) {
  const ids = game.preload_screens ?? (flow === undefined ? [] : [flow.entry])
  return ids.flatMap((id): PreloadScreen[] => {
    const screen = assets?.screens[id]
    return screen === undefined ? [] : [{ ...screen, id }]
  })
}

/**
 * Each screen's files, then the files of its atlases, then those of its fonts, in the order written; a file
 * listed twice keeps its first place. An atlas or font that cannot be resolved is a problem at its key.
 */
function preloadEntries(
  screens: readonly PreloadScreen[],
  built: AssetBuildFiles,
): { entries: Entry[]; problems: Problem[] } {
  const seen = new Set<string>()
  const entries: Entry[] = []
  const problems: Problem[] = []
  const add = (file: string, path: DataPath): void => {
    if (seen.has(file)) return
    seen.add(file)
    entries.push({ file, path })
  }
  for (const screen of screens) {
    screen.files.forEach((file, index) => {
      add(file, ['screens', screen.id, 'files', index])
    })
    for (const [key, resolve] of [
      ['atlases', built.atlas],
      ['fonts', built.font],
    ] as const) {
      screen[key]?.forEach((name, index) => {
        const path = ['screens', screen.id, key, index]
        const resolved = resolve(name)
        if (resolved === undefined) return
        if ('files' in resolved) for (const file of resolved.files) add(file, path)
        else problems.push({ path, code: resolved.code, message: resolved.message })
      })
    }
  }
  return { entries, problems }
}

/** A `missingAsset` problem for each entry the build lacks. */
const missingFromBuild = (entries: readonly Entry[], distDir: string) =>
  Effect.gen(function* () {
    const missing: Problem[] = []
    for (const entry of entries) {
      // `dir/*` names every file in a folder (Ruken's rule), so the folder itself must exist.
      const folder = entry.file.endsWith('/*') ? entry.file.slice(0, -2) : undefined
      const kind = yield* pathKind(join(distDir, folder ?? entry.file)).pipe(
        Effect.orElseSucceed(() => undefined),
      )
      const problem = (message: string) => missing.push({ path: entry.path, code: 'missingAsset', message })
      if (folder !== undefined && kind !== 'folder') {
        problem(`${entry.file} needs the folder ${folder} in the build`)
      } else if (folder === undefined && kind !== 'file') {
        problem(`${entry.file} is not in the build`)
      }
    }
    return missing
  })

/**
 * The files Ruken preloads before the game starts, in order, for `[loading] preload`: each `preload_screens`
 * screen's files from `assets.toml` (the flow's entry when none is named), then the pages of the atlases and
 * every language's subset of the fonts it names there, which `automata-content assets` wrote below `outDir`
 * and the build serves in `atlases/` and `fonts/`; without repeats. Empty without a `game.toml`. Fails with
 * `ContentCompileFailed` carrying a diagnostic for every file the build lacks (`missingAsset`), every atlas or
 * font not declared (`unknownReference`) or not built (`missingAsset`), all at once, or with
 * `InvalidContentConfig`.
 */
export const preloadList = (
  input: PreloadInput,
): Effect.Effect<string[], ContentCompileFailed | InvalidContentConfig> =>
  Effect.gen(function* () {
    const { data } = yield* compileContent(input.options)
    const game = data.game as GameSource | undefined
    if (game === undefined) return []
    const screens = preloadScreens(
      game,
      data.assets as AssetsSource | undefined,
      data.flow as FlowGraph | undefined,
    )
    const built = yield* readAssetBuildFiles(input.options.root, outDirOf(input.options), {
      atlases: screens.some((screen) => (screen.atlases?.length ?? 0) > 0),
      fonts: screens.some((screen) => (screen.fonts?.length ?? 0) > 0),
    })
    const { entries, problems } = preloadEntries(screens, built)
    problems.push(...(yield* missingFromBuild(entries, input.distDir)))
    if (problems.length === 0 && built.diagnostics.length === 0) return entries.map((entry) => entry.file)

    // Place each problem at its line in assets.toml, which compiled cleanly a moment ago.
    const text = yield* readTextIfPresent(join(input.options.root, 'content/assets.toml')).pipe(
      Effect.orElseSucceed(() => undefined),
    )
    const keys = locateKeys(text ?? '')
    const diagnostics: Diagnostic[] = problems.map(({ path, code, message }) => {
      const segments = path.map((segment) => (typeof segment === 'number' ? segment : String(segment)))
      const { line, column } = positionOf(keys, segments)
      return { code, file: 'content/assets.toml', line, column, keyPath: segments.join('.'), message }
    })
    return yield* new ContentCompileFailed({
      diagnostics: sortDiagnostics([...diagnostics, ...built.diagnostics]),
    })
  })
