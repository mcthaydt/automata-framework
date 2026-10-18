import { join } from 'node:path'
import { FileError, Files } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import type { ShipConfig } from '../config/ship-config.ts'
import {
  EntryMissing,
  ManifestInputsMismatch,
  type ManifestInvalid,
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
import { findRootAbsoluteReferences } from './root-absolute.ts'
import { findSecretsInBuild, readEnvValues } from './secret-scan.ts'

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
   * Left out, nothing is checked.
   */
  readonly inputBindings?: ShipInputBindings | undefined
}

export type PrepareError =
  | VersionMismatch
  | RootAbsoluteReference
  | SecretInBuild
  | UndeclaredBoard
  | EntryMissing
  | ManifestInputsMismatch
  | ManifestInvalid
  | FileError

/**
 * Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the
 * entry page, root-absolute paths, secrets (QB-b) and the leaderboards the game names (M5.7), then writes `ruken.toml` once Ruken's parser accepts it. Every check
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

    if (input.inputBindings !== undefined) {
      const problems = inputsProblems(config.runtime.inputs, input.inputBindings)
      if (problems.length > 0) return yield* new ManifestInputsMismatch({ problems })
    }

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

    if (input.gameDir !== undefined) {
      const gameDir = input.gameDir
      const boards = yield* Effect.try({
        try: () => findUndeclaredBoards(gameDir, Object.keys(config.leaderboards ?? {})),
        catch: (cause) => new FileError({ path: gameDir, cause }),
      })
      if (boards.length > 0) return yield* new UndeclaredBoard({ found: boards })
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
