import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import type { ShipConfig } from '../config/ship-config.ts'
import {
  EntryMissing,
  FileError,
  type ManifestInvalid,
  RootAbsoluteReference,
  VersionMismatch,
} from '../errors.ts'
import { checkManifest } from '../manifest/check-manifest.ts'
import { rukenToml } from '../manifest/ruken-toml.ts'
import { checkVersion } from './check-version.ts'
import { findRootAbsoluteReferences } from './root-absolute.ts'

export interface PrepareInput {
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string
  readonly config: ShipConfig
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined
}

export type PrepareError =
  | VersionMismatch
  | RootAbsoluteReference
  | EntryMissing
  | ManifestInvalid
  | FileError

/**
 * Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the
 * entry page and root-absolute paths, then writes `ruken.toml` once Ruken's parser accepts it. Every check
 * runs before the write, so a failed prepare leaves the folder as it was. Zipping and Ruken's build checks
 * (archive, size, file types) happen inside `ruken publish`, not here.
 */
export function prepareBuild(input: PrepareInput): Effect.Effect<{ manifestPath: string }, PrepareError> {
  return Effect.gen(function* () {
    const { distDir, config, tag } = input
    const mismatch = checkVersion(config.game.version, tag)
    if (mismatch !== undefined && tag !== undefined) {
      return yield* new VersionMismatch({ version: config.game.version, tag, message: mismatch })
    }

    const references = yield* Effect.try({
      try: () => findRootAbsoluteReferences(distDir),
      catch: (cause) => new FileError({ path: distDir, cause }),
    })
    if (references.length > 0) return yield* new RootAbsoluteReference({ references })

    if (!existsSync(join(distDir, config.game.entry))) {
      return yield* new EntryMissing({ entry: config.game.entry, distDir })
    }

    const toml = rukenToml(config)
    yield* checkManifest(toml)
    const manifestPath = join(distDir, 'ruken.toml')
    yield* Effect.try({
      try: () => writeFileSync(manifestPath, toml),
      catch: (cause) => new FileError({ path: manifestPath, cause }),
    })
    return { manifestPath }
  })
}
