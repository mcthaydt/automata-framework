import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import type { ShipConfig } from '../../config/ship-config.ts'
import type { ManifestInvalid } from '../../errors.ts'
import { checkManifest, manifestOf } from './check-manifest.ts'
import { rukenToml } from './ruken-toml.ts'

/** Where the headers are for: Ruken's production site, or a page on the given origins that frames the game. */
export type RukenHeaderTarget = Parameters<typeof compileHeaders>[1]

/**
 * The headers Ruken serves a game's build with (Ruken's CSP, which allows no eval), from the game's config, for a
 * game's `vite preview` (the game imports no `@ruken/*` itself). Fails `ManifestInvalid`
 * when Ruken refuses the config.
 */
export function rukenHeaders(
  config: ShipConfig,
  target: RukenHeaderTarget,
): Effect.Effect<Record<string, string>, ManifestInvalid> {
  return Effect.map(checkManifest(rukenToml(config)), (manifest) => compileHeaders(manifest, target))
}

/** `rukenHeaders` for a caller outside Effect (a game's `vite.config.ts`): the headers, or a thrown `ManifestInvalid`. */
export function rukenHeadersOf(config: ShipConfig, target: RukenHeaderTarget): Record<string, string> {
  return compileHeaders(manifestOf(rukenToml(config)), target)
}
