import { Effect } from 'effect'
import { type FileError, tryFile } from '../../node/errors.ts'
import { Pixi3dExtrasInBuild, SecretInBuild, VersionMismatch } from '../errors.ts'
import { checkVersion } from './check-version.ts'
import { findPixi3d } from './pixi3d-markers.ts'
import { findSecretsInBuild, readEnvValues } from './secret-scan.ts'

// The checks that every target that publishes a build makes, in the same words: the release tag is the game's version,
// nothing secret is in the build, and nor is Pixi 3D's extras, which need `eval`. Ruken, itch.io, the web and the
// desktop each call them, so a rule changes in one place.

/** A release's version must be its tag's. A branch build has no tag and passes. */
export function checkTag(version: string, tag: string | undefined): Effect.Effect<void, VersionMismatch> {
  const mismatch = checkVersion(version, tag)
  return mismatch !== undefined && tag !== undefined
    ? Effect.fail(new VersionMismatch({ version, tag, message: mismatch }))
    : Effect.void
}

export interface ScanBuildInput {
  /** The built game folder. */
  readonly distDir: string
  /**
   * The game's folder, whose `.env*` values must not appear in the build. Without it, no `.env` file is read and only
   * key formats and high-entropy strings are checked.
   */
  readonly gameDir?: string | undefined
}

/**
 * Secrets first, then `@pixi/3d/extras` (S7-g: its particle code probes `new Function` at load, which a no-eval CSP
 * refuses). `@pixi/3d` itself is public (npmjs.org, MIT) and passes. The first thing found stops the build.
 */
export function scanBuild(
  input: ScanBuildInput,
): Effect.Effect<void, SecretInBuild | Pixi3dExtrasInBuild | FileError> {
  return Effect.gen(function* () {
    const { distDir, gameDir } = input
    const secrets = yield* tryFile(distDir, () =>
      findSecretsInBuild(distDir, gameDir === undefined ? [] : readEnvValues(gameDir)),
    )
    if (secrets.length > 0) return yield* new SecretInBuild({ found: secrets })

    const pixi3d = yield* tryFile(distDir, () => findPixi3d(distDir))
    if (pixi3d.extras.length > 0) return yield* new Pixi3dExtrasInBuild({ found: pixi3d.extras })
  })
}
