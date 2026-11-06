import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { type FileError, tryFile } from '../../../node/errors.ts'
import type { ShipConfig } from '../../config/ship-config.ts'
import {
  ItchBuildInvalid,
  type ItchCheck,
  type Pixi3dExtrasInBuild,
  type Pixi3dInPublicBuild,
  RootAbsoluteReference,
  type SecretInBuild,
  type VersionMismatch,
} from '../../errors.ts'
import { buildFiles } from '../../prepare/build-files.ts'
import { checkTag, scanBuild } from '../../prepare/build-scans.ts'
import { findRootAbsoluteReferences } from '../../prepare/root-absolute.ts'
import {
  checkFileCount,
  checkFileSizes,
  checkItchEntry,
  checkNoRukenToml,
  checkPathLengths,
  findCaseMismatches,
} from './itch-checks.ts'
import { writeDeterministicZip } from './itch-zip.ts'

/** What `prepareItch` checks and zips: the built folder, the ship config and the release tag. */
export interface PrepareItchInput {
  /** The built game folder. It is checked and zipped as it is; nothing is written into it. */
  readonly distDir: string
  readonly config: ShipConfig
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined
  /** The game's folder, whose `.env*` values must not appear in the build. Without it only keys and entropy are scanned. */
  readonly gameDir?: string | undefined
}

export type PrepareItchError =
  | VersionMismatch
  | RootAbsoluteReference
  | SecretInBuild
  | Pixi3dInPublicBuild
  | Pixi3dExtrasInBuild
  | ItchBuildInvalid
  | FileError

/**
 * Makes a built folder ready for itch.io: the tag, root-absolute paths, secrets (a page on
 * itch.io is public, so the build is scanned as Ruken's is), `@pixi/3d`, `index.html`, itch.io's
 * limits, reference case and a stray `ruken.toml` are checked in that order, and the first that fails stops
 * prepare before anything is written. Then `<id>-<version>-itch.zip` is written beside the build folder (not in
 * it, so `butler push <dist>` never uploads it), for a manual upload; butler pushes the folder itself.
 *
 * The build itself must already be an itch build (`resolve.conditions: ['automata-web']`); that is the
 * game's build step, not ship's.
 */
export function prepareItch(input: PrepareItchInput): Effect.Effect<{ zipPath: string }, PrepareItchError> {
  return Effect.gen(function* () {
    const { distDir, config, tag, gameDir } = input
    yield* checkTag(config.game.version, tag)

    const references = yield* tryFile(distDir, () => findRootAbsoluteReferences(distDir))
    if (references.length > 0) return yield* new RootAbsoluteReference({ references })

    // An itch.io page is public, so the build is scanned as Ruken's is: no secret, and not the closed beta (X-b).
    yield* scanBuild({ distDir, gameDir })

    const files = yield* tryFile(distDir, () => buildFiles(distDir))
    const checks: readonly [ItchCheck, () => string[]][] = [
      ['entry', () => checkItchEntry(files, config.game.entry)],
      ['file-count', () => checkFileCount(files)],
      ['path-length', () => checkPathLengths(files)],
      ['file-size', () => checkFileSizes(distDir, files)],
      ['case', () => findCaseMismatches(distDir, files)],
      ['ruken-toml', () => checkNoRukenToml(files)],
    ]
    for (const [check, run] of checks) {
      const problems = yield* tryFile(distDir, run)
      if (problems.length > 0) return yield* new ItchBuildInvalid({ check, problems })
    }

    const zipPath = join(dirname(distDir), `${config.game.id}-${config.game.version}-itch.zip`)
    yield* tryFile(distDir, () => writeDeterministicZip(zipPath, distDir, files))
    return { zipPath }
  })
}
