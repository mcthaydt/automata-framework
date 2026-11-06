import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { scanForDataUrls } from '../../../check/data-url-scan.ts'
import { scanForEval } from '../../../check/no-eval-scan.ts'
import { type FileError, tryFile } from '../../../node/errors.ts'
import type { ShipConfig } from '../../config/ship-config.ts'
import {
  EntryMissing,
  type Pixi3dExtrasInBuild,
  type Pixi3dInPublicBuild,
  RootAbsoluteReference,
  type SecretInBuild,
  type VersionMismatch,
  WebBuildInvalid,
  type WebCheck,
} from '../../errors.ts'
import { buildFiles } from '../../prepare/build-files.ts'
import { checkTag, scanBuild } from '../../prepare/build-scans.ts'
import { findRootAbsoluteReferences } from '../../prepare/root-absolute.ts'

/** What `prepareWeb` checks: the built folder, the ship config and the release tag. */
export interface PrepareWebInput {
  /** The built game folder. It is checked as it is; nothing is written into it. */
  readonly distDir: string
  readonly config: ShipConfig
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined
  /** The game's folder, whose `.env*` values must not appear in the build. Without it only keys and entropy are scanned. */
  readonly gameDir?: string | undefined
}

export type PrepareWebError =
  | VersionMismatch
  | RootAbsoluteReference
  | SecretInBuild
  | Pixi3dInPublicBuild
  | Pixi3dExtrasInBuild
  | EntryMissing
  | WebBuildInvalid
  | FileError

/**
 * Checks a built folder before it goes on any static host. The web target has nothing to package, so this is the
 * checks every public target runs and nothing else: the tag, the entry page, root-absolute paths, secrets, the
 * closed Pixi 3D beta, then the two scans of the bundle that `automata check` makes (no eval, no assets inlined as
 * `data:` URLs). The first that fails stops it, and the folder is never changed.
 */
export function prepareWeb(input: PrepareWebInput): Effect.Effect<{ files: number }, PrepareWebError> {
  return Effect.gen(function* () {
    const { distDir, config, tag, gameDir } = input
    yield* checkTag(config.game.version, tag)

    const files = yield* tryFile(distDir, () => buildFiles(distDir))
    if (!files.includes(config.game.entry)) {
      return yield* new EntryMissing({ entry: config.game.entry, distDir })
    }

    const references = yield* tryFile(distDir, () => findRootAbsoluteReferences(distDir))
    if (references.length > 0) return yield* new RootAbsoluteReference({ references })

    // A web page is public: secrets and the closed Pixi 3D beta never go there.
    yield* scanBuild({ distDir, gameDir })

    const scripts = files.filter((name) => name.endsWith('.js'))
    const scans: readonly [
      WebCheck,
      (file: string, code: string) => { file: string; line: number; col: number; message: string }[],
    ][] = [
      ['no-eval', scanForEval],
      ['data-urls', scanForDataUrls],
    ]
    for (const [check, scan] of scans) {
      const problems = yield* tryFile(distDir, () =>
        scripts.flatMap((name) =>
          scan(name, readFileSync(join(distDir, name), 'utf8')).map(
            (found) => `${found.file}:${found.line}:${found.col} ${found.message}`,
          ),
        ),
      )
      if (problems.length > 0) return yield* new WebBuildInvalid({ check, problems })
    }

    return { files: files.length }
  })
}
