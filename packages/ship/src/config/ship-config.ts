import type { Manifest } from '@ruken/manifest'

/**
 * What a game tells ship about itself, in Ruken's own manifest shape (`@ruken/manifest`'s `Manifest`).
 * Keys keep Ruken's snake_case so the config reads like the `ruken.toml` it becomes. ship fills in
 * `schema` and `allow_eval` (always false); every other field and allowed value is Ruken's, so a field
 * Ruken does not define is a type error here.
 */
export interface ShipConfig {
  readonly game: Manifest['game']
  readonly runtime: Omit<Manifest['runtime'], 'allow_eval'>
  readonly network: Manifest['network']
  readonly content: Manifest['content']
  readonly analytics?: Manifest['analytics']
  readonly loading?: NonNullable<Manifest['loading']>
  readonly leaderboards?: Manifest['leaderboards']
}

/** Identity function that gives a game's `ship.config.ts` type checking and editor completion. */
export function defineShipConfig(config: ShipConfig): ShipConfig {
  return config
}
