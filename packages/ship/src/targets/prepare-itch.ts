import { dirname, join } from 'node:path'
import { FileError } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import type { ShipConfig } from '../config/ship-config.ts'
import { ItchBuildInvalid, type ItchCheck, RootAbsoluteReference, VersionMismatch } from '../errors.ts'
import { buildFiles } from '../prepare/build-files.ts'
import { checkVersion } from '../prepare/check-version.ts'
import { findRootAbsoluteReferences } from '../prepare/root-absolute.ts'
import {
  checkFileCount,
  checkFileSizes,
  checkItchEntry,
  checkNoRukenToml,
  checkPathLengths,
  findCaseMismatches,
} from './itch-checks.ts'
import { writeDeterministicZip } from './itch-zip.ts'

export interface PrepareItchInput {
  /** The built game folder. It is checked and zipped as it is; nothing is written into it. */
  readonly distDir: string
  readonly config: ShipConfig
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined
}

export type PrepareItchError = VersionMismatch | RootAbsoluteReference | ItchBuildInvalid | FileError

/**
 * Makes a built folder ready for itch.io (PUB spec §4): the tag, root-absolute paths, `index.html`, itch.io's
 * limits, reference case and a stray `ruken.toml` are checked in that order, and the first that fails stops
 * prepare before anything is written. Then `<id>-<version>-itch.zip` is written beside the build folder (not in
 * it, so `butler push <dist>` never uploads it), for a manual upload; butler pushes the folder itself.
 *
 * The build itself must already be an itch build (`resolve.conditions: ['automata-web']`, PUB.1); that is the
 * game's build step, not ship's.
 */
export function prepareItch(input: PrepareItchInput): Effect.Effect<{ zipPath: string }, PrepareItchError> {
  return Effect.gen(function* () {
    const { distDir, config, tag } = input
    const mismatch = checkVersion(config.game.version, tag)
    if (mismatch !== undefined && tag !== undefined) {
      return yield* new VersionMismatch({ version: config.game.version, tag, message: mismatch })
    }

    const attempt = <A>(run: () => A) =>
      Effect.try({ try: run, catch: (cause) => new FileError({ path: distDir, cause }) })

    const references = yield* attempt(() => findRootAbsoluteReferences(distDir))
    if (references.length > 0) return yield* new RootAbsoluteReference({ references })

    const files = yield* attempt(() => buildFiles(distDir))
    const checks: readonly [ItchCheck, () => string[]][] = [
      ['entry', () => checkItchEntry(files, config.game.entry)],
      ['file-count', () => checkFileCount(files)],
      ['path-length', () => checkPathLengths(files)],
      ['file-size', () => checkFileSizes(distDir, files)],
      ['case', () => findCaseMismatches(distDir, files)],
      ['ruken-toml', () => checkNoRukenToml(files)],
    ]
    for (const [check, run] of checks) {
      const problems = yield* attempt(run)
      if (problems.length > 0) return yield* new ItchBuildInvalid({ check, problems })
    }

    const zipPath = join(dirname(distDir), `${config.game.id}-${config.game.version}-itch.zip`)
    yield* attempt(() => writeDeterministicZip(zipPath, distDir, files))
    return { zipPath }
  })
}
