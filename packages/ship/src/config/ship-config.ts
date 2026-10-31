import type { GameConfig } from '@mcthaydt/automata-content/game-config'
import type { ItchConfig } from './itch-config.schema.ts'
import type { TauriConfig } from './tauri-config.schema.ts'

/**
 * What a game tells ship about itself: the game config every target reads (`@mcthaydt/automata-content`'s
 * `GameConfig`, DIST spec §4.4) and each target's own section. Keys keep Ruken's manifest names and snake_case, so
 * the config reads like the `ruken.toml` the Ruken target writes from it (ship fills in `schema` and `allow_eval`,
 * always false); `prepare --target ruken` checks the whole of it with Ruken's own parser.
 */
export interface ShipConfig extends GameConfig {
  /**
   * Where `automata-ship publish --target itch` pushes (PUB spec §4). Not a Ruken field: it is never written to
   * `ruken.toml`, and a Ruken build ignores it.
   */
  readonly itch?: ItchConfig | undefined
  /**
   * The desktop build's settings (`automata-ship prepare --target tauri`, DIST spec §6.3). Not a Ruken field: it is
   * never written to `ruken.toml`.
   */
  readonly tauri?: TauriConfig | undefined
  /**
   * Who the game's builds are for. `private` is a game that carries `@pixi/3d`, a closed beta (D-1), until Pixi 3D's
   * public release: `automata-ship prepare` then checks the build as private and writes no `ruken.toml`, and only
   * `deploy-dev` and `publish --private` ship it (M3 spec §4.8). Not a Ruken field. Left out, a game is `public`.
   */
  readonly audience?: 'public' | 'private' | undefined
}

/** Identity function that gives a game's `ship.config.ts` type checking and editor completion. */
export function defineShipConfig(config: ShipConfig): ShipConfig {
  return config
}
