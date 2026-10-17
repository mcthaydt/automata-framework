import type { QualityTier, SettingsStore } from '@mcthaydt/automata-runtime'

/** What `rebuildOnQuality` keeps mounted. */
export interface QualityBuild<T> {
  /** The build for the tier now. */
  current(): T
  /** Stops following the setting and destroys the build. */
  dispose(): void
}

/**
 * Keeps something built for the player's quality tier (M4 spec §4.11), rebuilding it when the tier changes.
 *
 * Quality decides which passes a build makes at all, so a change is a rebuild, not a toggle. The old build is
 * destroyed before the new one is made: two live builds would both hold their GPU resources. From FloorFifty
 * `apps/client/src/systems/render/quality-rebuild.ts` at `ac72660`, over runtime's `SettingsStore` with `read`
 * picking the tier out of the game's settings.
 */
export function rebuildOnQuality<S, T extends { destroy(): void }>(
  settings: SettingsStore<S>,
  read: (settings: S) => QualityTier,
  build: (tier: QualityTier) => T,
  onBuilt?: (built: T) => void,
): QualityBuild<T> {
  let tier = read(settings.get())
  let built = build(tier)
  onBuilt?.(built)

  const release = settings.subscribe((next) => {
    const nextTier = read(next)
    if (nextTier === tier) return
    tier = nextTier
    built.destroy()
    built = build(tier)
    onBuilt?.(built)
  })

  return {
    current: () => built,
    dispose: () => {
      release()
      built.destroy()
    },
  }
}
