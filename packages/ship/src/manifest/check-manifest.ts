import { type Manifest, parseManifest } from '@ruken/manifest'
import { Effect } from 'effect'
import { ManifestInvalid } from '../errors.ts'

/** Checks `ruken.toml` text with Ruken's own parser, so AF accepts exactly what Ruken accepts. */
export function checkManifest(toml: string): Effect.Effect<Manifest, ManifestInvalid> {
  const result = parseManifest(toml)
  return result.ok
    ? Effect.succeed(result.manifest)
    : Effect.fail(new ManifestInvalid({ problems: result.errors }))
}
