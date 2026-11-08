import type { ShipConfig } from '../config/ship-config.ts'

// How `prepare` readies a build. It follows the game's config: a private game is checked as private but gets no
// ruken.toml, so a raw `ruken publish` of the folder has nothing to upload (the review of #241 refused a private
// prepare that wrote one). `publish` decides for itself (`--private`).

/** Who a prepared build is for, and whether `ruken.toml` is written. */
export interface PrepareMode {
  readonly audience: 'public' | 'private'
  readonly writeManifest: boolean
}

export function prepareMode(config: Pick<ShipConfig, 'audience'>): PrepareMode {
  return config.audience === 'private'
    ? { audience: 'private', writeManifest: false }
    : { audience: 'public', writeManifest: true }
}
