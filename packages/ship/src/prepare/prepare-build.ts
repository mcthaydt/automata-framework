import { join } from 'node:path'
import { FileError, Files } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import type { ShipConfig } from '../config/ship-config.ts'
import {
  EntryMissing,
  ManifestInputsMismatch,
  type ManifestInvalid,
  OrientationMismatch,
  RootAbsoluteReference,
  SecretInBuild,
  UndeclaredBoard,
  VersionMismatch,
} from '../errors.ts'
import { inputsProblems, type ShipInputBindings } from '../manifest/check-inputs.ts'
import { checkManifest } from '../manifest/check-manifest.ts'
import { rukenToml } from '../manifest/ruken-toml.ts'
import { findUndeclaredBoards } from './board-names.ts'
import { checkVersion } from './check-version.ts'
import { findInputsProblems } from './input-bindings.ts'
import { findOrientationMismatches } from './orientation.ts'
import { findRootAbsoluteReferences } from './root-absolute.ts'
import { findSecretsInBuild, readEnvValues } from './secret-scan.ts'

/**
 * What `prepareBuild` checks and writes into: the built folder, the ship config, and the optional release
 * tag, game folder and input bindings.
 */
export interface PrepareInput {
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string
  readonly config: ShipConfig
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined
  /**
   * The game folder, whose `.env*` values must not appear in the build (QB-b). The CLI passes its working folder;
   * when it is left out, no `.env` file is read and only key formats and high-entropy strings are checked.
   */
  readonly gameDir?: string | undefined
  /**
   * The game's input bindings (its input map's `profile.bindings`), checked against `runtime.inputs` (I-g).
   * Left out, the `keys()` calls in `gameDir`'s sources are read instead (M4.1 follow-up); with neither, nothing
   * is checked.
   */
  readonly inputBindings?: ShipInputBindings | undefined
}

export type PrepareError =
  | VersionMismatch
  | RootAbsoluteReference
  | SecretInBuild
  | UndeclaredBoard
  | OrientationMismatch
  | EntryMissing
  | ManifestInputsMismatch
  | ManifestInvalid
  | FileError

/**
 * Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the
 * entry page, root-absolute paths, secrets (QB-b), the leaderboards the game names (M5.7) and the orientation it plays in (M4.7) and the devices its `keys()` calls bind (M4.1), then writes `ruken.toml` once Ruken's parser accepts it. Every check
 * runs before the write, so a failed prepare leaves the folder as it was. Zipping and Ruken's build checks
 * (archive, size, file types) happen inside `ruken publish`, not here.
 */
export function prepareBuild(
  input: PrepareInput,
): Effect.Effect<{ manifestPath: string }, PrepareError, Files> {
  return Effect.gen(function* () {
    const { distDir, config, tag } = input
    const files = yield* Files
    const mismatch = checkVersion(config.game.version, tag)
    if (mismatch !== undefined && tag !== undefined) {
      return yield* new VersionMismatch({ version: config.game.version, tag, message: mismatch })
    }

    // The caller's bindings are the real input map; without them the game's keys() calls are read from its sources.
    const gameDir = input.gameDir
    const inputProblems =
      input.inputBindings !== undefined
        ? inputsProblems(config.runtime.inputs, input.inputBindings)
        : gameDir === undefined
          ? []
          : yield* Effect.try({
              try: () => findInputsProblems(gameDir, config.runtime.inputs),
              catch: (cause) => new FileError({ path: gameDir, cause }),
            })
    if (inputProblems.length > 0) return yield* new ManifestInputsMismatch({ problems: inputProblems })

    const references = yield* Effect.try({
      try: () => findRootAbsoluteReferences(distDir),
      catch: (cause) => new FileError({ path: distDir, cause }),
    })
    if (references.length > 0) return yield* new RootAbsoluteReference({ references })

    const secrets = yield* Effect.try({
      try: () => findSecretsInBuild(distDir, input.gameDir === undefined ? [] : readEnvValues(input.gameDir)),
      catch: (cause) => new FileError({ path: distDir, cause }),
    })
    if (secrets.length > 0) return yield* new SecretInBuild({ found: secrets })

    if (gameDir !== undefined) {
      const boards = yield* Effect.try({
        try: () => findUndeclaredBoards(gameDir, Object.keys(config.leaderboards ?? {})),
        catch: (cause) => new FileError({ path: gameDir, cause }),
      })
      if (boards.length > 0) return yield* new UndeclaredBoard({ found: boards })
      const orientations = yield* Effect.try({
        try: () => findOrientationMismatches(gameDir, config.runtime.orientation),
        catch: (cause) => new FileError({ path: gameDir, cause }),
      })
      if (orientations.length > 0) return yield* new OrientationMismatch({ found: orientations })
    }

    if (!(yield* files.exists(join(distDir, config.game.entry)))) {
      return yield* new EntryMissing({ entry: config.game.entry, distDir })
    }

    const toml = rukenToml(config)
    yield* checkManifest(toml)
    const manifestPath = join(distDir, 'ruken.toml')
    yield* files.writeText(manifestPath, toml)
    return { manifestPath }
  })
}
