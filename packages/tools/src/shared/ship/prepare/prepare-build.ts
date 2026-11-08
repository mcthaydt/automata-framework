import { join } from 'node:path'
import { Effect } from 'effect'
import { type FileError, tryFile } from '../../node/errors.ts'
import { Files } from '../../node/files.ts'
import type { ShipConfig } from '../config/ship-config.ts'
import {
  EntryMissing,
  ManifestInputsMismatch,
  type ManifestInvalid,
  OrientationMismatch,
  type Pixi3dExtrasInBuild,
  type Pixi3dInPublicBuild,
  RootAbsoluteReference,
  type SecretInBuild,
  UndeclaredBoard,
  type VersionMismatch,
} from '../errors.ts'
import { inputsProblems, type ShipInputBindings } from '../targets/ruken/check-inputs.ts'
import { checkManifest } from '../targets/ruken/check-manifest.ts'
import { rukenToml } from '../targets/ruken/ruken-toml.ts'
import { findUndeclaredBoards } from './board-names.ts'
import { checkTag, scanBuild } from './build-scans.ts'
import { findInputsProblems } from './input-bindings.ts'
import { findOrientationMismatches } from './orientation.ts'
import { findRootAbsoluteReferences } from './root-absolute.ts'

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
   * The game folder, whose `.env*` values must not appear in the build. The CLI passes its working folder;
   * when it is left out, no `.env` file is read and only key formats and high-entropy strings are checked.
   */
  readonly gameDir?: string | undefined
  /**
   * The game's input bindings (its input map's `profile.bindings`), checked against `runtime.inputs`.
   * Left out, the `keys()` calls in `gameDir`'s sources are read instead; with neither, nothing
   * is checked.
   */
  readonly inputBindings?: ShipInputBindings | undefined
  /**
   * Who the build is for. `public` (the default: Ruken's store, through `publish`) refuses a build that contains
   * `@pixi/3d`, a closed beta (X-b); `private` (Ruken's local stack, `publish --private`) allows it. Either refuses `@pixi/3d/extras` (S7-g).
   */
  readonly audience?: 'public' | 'private' | undefined
}

export type PrepareError =
  | VersionMismatch
  | RootAbsoluteReference
  | SecretInBuild
  | Pixi3dInPublicBuild
  | Pixi3dExtrasInBuild
  | UndeclaredBoard
  | OrientationMismatch
  | EntryMissing
  | ManifestInputsMismatch
  | ManifestInvalid
  | FileError

/**
 * Makes a built folder ready for `ruken publish`: checks the tag, the
 * entry page, root-absolute paths, secrets, `@pixi/3d`, the leaderboards the game names and the orientation it plays in and the devices its `keys()` calls bind, then writes `ruken.toml` once Ruken's parser accepts it. Every check
 * runs before the write, so a failed prepare leaves the folder as it was. Zipping and Ruken's build checks
 * (archive, size, file types) happen inside `ruken publish`, not here.
 */
export function prepareBuild(
  input: PrepareInput,
): Effect.Effect<{ manifestPath: string }, PrepareError, Files> {
  return Effect.gen(function* () {
    const { toml } = yield* checkBuild(input)
    const files = yield* Files
    const manifestPath = join(input.distDir, 'ruken.toml')
    yield* files.writeText(manifestPath, toml)
    return { manifestPath }
  })
}

/**
 * Every check `prepareBuild` makes, Ruken's parser included, writing nothing: the `ruken.toml` it would write.
 * CI's `prepare` of a private game uses it alone, so a raw `ruken publish` of the folder has no manifest to upload
 *.
 */
export function checkBuild(input: PrepareInput): Effect.Effect<{ toml: string }, PrepareError, Files> {
  return Effect.gen(function* () {
    const { distDir, config, tag } = input
    const files = yield* Files
    yield* checkTag(config.game.version, tag)

    // The caller's bindings are the real input map; without them the game's keys() calls are read from its sources.
    const gameDir = input.gameDir
    const inputProblems =
      input.inputBindings !== undefined
        ? inputsProblems(config.runtime.inputs, input.inputBindings)
        : gameDir === undefined
          ? []
          : yield* tryFile(gameDir, () => findInputsProblems(gameDir, config.runtime.inputs))
    if (inputProblems.length > 0) return yield* new ManifestInputsMismatch({ problems: inputProblems })

    const references = yield* tryFile(distDir, () => findRootAbsoluteReferences(distDir))
    if (references.length > 0) return yield* new RootAbsoluteReference({ references })

    yield* scanBuild({ distDir, gameDir: input.gameDir, audience: input.audience })

    if (gameDir !== undefined) {
      const boards = yield* tryFile(gameDir, () =>
        findUndeclaredBoards(gameDir, Object.keys(config.leaderboards ?? {})),
      )
      if (boards.length > 0) return yield* new UndeclaredBoard({ found: boards })
      const orientations = yield* tryFile(gameDir, () =>
        findOrientationMismatches(gameDir, config.runtime.orientation),
      )
      if (orientations.length > 0) return yield* new OrientationMismatch({ found: orientations })
    }

    if (!(yield* files.exists(join(distDir, config.game.entry)))) {
      return yield* new EntryMissing({ entry: config.game.entry, distDir })
    }

    const toml = rukenToml(config)
    yield* checkManifest(toml)
    return { toml }
  })
}
