import type { ShipConfig } from '../config/ship-config.ts'

// How each command prepares a build. deploy-dev goes to the dev host behind its access
// control, so it may carry @pixi/3d and needs its manifest. `prepare` follows the game's config: a private game is
// checked as private but gets no ruken.toml, so a raw `ruken publish` of the folder has nothing to upload (the
// review of #241 refused a private prepare that wrote one). `publish` decides for itself (`--private`).

/** Who a prepared build is for, and whether `ruken.toml` is written. */
export interface PrepareMode {
  readonly audience: 'public' | 'private'
  readonly writeManifest: boolean
}

export function prepareMode(
  command: 'prepare' | 'deploy-dev',
  config: Pick<ShipConfig, 'audience'>,
): PrepareMode {
  if (command === 'deploy-dev') return { audience: 'private', writeManifest: true }
  if (config.audience === 'private') return { audience: 'private', writeManifest: false }
  return { audience: 'public', writeManifest: true }
}
