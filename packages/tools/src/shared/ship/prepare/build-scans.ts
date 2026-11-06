import { Effect } from 'effect'
import { type FileError, tryFile } from '../../node/errors.ts'
import { Pixi3dExtrasInBuild, Pixi3dInPublicBuild, SecretInBuild, VersionMismatch } from '../errors.ts'
import { checkVersion } from './check-version.ts'
import { findPixi3d } from './pixi3d-markers.ts'
import { findSecretsInBuild, readEnvValues } from './secret-scan.ts'

// The checks that every target that publishes a build makes, in the same words: the release tag is the game's version,
// and nothing secret or private is in the build. Ruken, itch.io, the web and the desktop each call them, so a rule
// changes in one place.

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
  /**
   * Who the build is for. A `public` build (the default) refuses `@pixi/3d`, a closed beta (X-b); a `private` one
   * (Ruken's local stack) may carry it. Either refuses `@pixi/3d/extras` (S7-g).
   */
  readonly audience?: 'public' | 'private' | undefined
}

/** Secrets first, then the closed beta. The first thing found stops the build. */
export function scanBuild(
  input: ScanBuildInput,
): Effect.Effect<void, SecretInBuild | Pixi3dInPublicBuild | Pixi3dExtrasInBuild | FileError> {
  return Effect.gen(function* () {
    const { distDir, gameDir } = input
    const secrets = yield* tryFile(distDir, () =>
      findSecretsInBuild(distDir, gameDir === undefined ? [] : readEnvValues(gameDir)),
    )
    if (secrets.length > 0) return yield* new SecretInBuild({ found: secrets })

    const pixi3d = yield* tryFile(distDir, () => findPixi3d(distDir))
    if (pixi3d.extras.length > 0) return yield* new Pixi3dExtrasInBuild({ found: pixi3d.extras })
    if ((input.audience ?? 'public') === 'public' && pixi3d.core.length > 0)
      return yield* new Pixi3dInPublicBuild({ found: pixi3d.core })
  })
}
