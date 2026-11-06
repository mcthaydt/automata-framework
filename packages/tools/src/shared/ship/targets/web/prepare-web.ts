import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { scanForDataUrls } from '../../../check/data-url-scan.ts'
import { scanForEval } from '../../../check/no-eval-scan.ts'
import { FileError } from '../../../node/errors.ts'
import type { ShipConfig } from '../../config/ship-config.ts'
import {
  EntryMissing,
  Pixi3dExtrasInBuild,
  Pixi3dInPublicBuild,
  RootAbsoluteReference,
  SecretInBuild,
  VersionMismatch,
  WebBuildInvalid,
  type WebCheck,
} from '../../errors.ts'
import { buildFiles } from '../../prepare/build-files.ts'
import { checkVersion } from '../../prepare/check-version.ts'
import { findPixi3d } from '../../prepare/pixi3d-markers.ts'
import { findRootAbsoluteReferences } from '../../prepare/root-absolute.ts'
import { findSecretsInBuild, readEnvValues } from '../../prepare/secret-scan.ts'

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
    const mismatch = checkVersion(config.game.version, tag)
    if (mismatch !== undefined && tag !== undefined) {
      return yield* new VersionMismatch({ version: config.game.version, tag, message: mismatch })
    }

    const attempt = <A>(run: () => A) =>
      Effect.try({ try: run, catch: (cause) => new FileError({ path: distDir, cause }) })

    const files = yield* attempt(() => buildFiles(distDir))
    if (!files.includes(config.game.entry)) {
      return yield* new EntryMissing({ entry: config.game.entry, distDir })
    }

    const references = yield* attempt(() => findRootAbsoluteReferences(distDir))
    if (references.length > 0) return yield* new RootAbsoluteReference({ references })

    const secrets = yield* attempt(() =>
      findSecretsInBuild(distDir, gameDir === undefined ? [] : readEnvValues(gameDir)),
    )
    if (secrets.length > 0) return yield* new SecretInBuild({ found: secrets })

    // A web page is public: the closed beta never goes there (X-b), nor its extras (S7-g).
    const pixi3d = yield* attempt(() => findPixi3d(distDir))
    if (pixi3d.extras.length > 0) return yield* new Pixi3dExtrasInBuild({ found: pixi3d.extras })
    if (pixi3d.core.length > 0) return yield* new Pixi3dInPublicBuild({ found: pixi3d.core })

    const scripts = files.filter((name) => name.endsWith('.js'))
    const scans: readonly [
      WebCheck,
      (file: string, code: string) => { file: string; line: number; col: number; message: string }[],
    ][] = [
      ['no-eval', scanForEval],
      ['data-urls', scanForDataUrls],
    ]
    for (const [check, scan] of scans) {
      const problems = yield* attempt(() =>
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
