import type { Filter } from 'pixi.js'
import type { QualityTier } from '../../../shared/runtime/display-settings.schema.ts'
import { meetsTier } from '../quality/meets-tier.js'

/** Where the composed filters go: `PixiStage` (its scene's `filters`), or any Pixi container. */
export interface PostFilterTarget {
  filters: Filter[] | null
}

/**
 * The post-filter slot: each owner (an extension, quality tiers, the game) keeps its own
 * filters under its id, and the slot writes all of them to the target, ordered by `order` (lower first), then
 * by id. Once a slot is in use it owns the target's `filters`; assigning them directly is overwritten on the
 * next change. Filters stay GLSL + WGSL pairs (`filterPrograms`), so WebGL2 keeps parity with WebGPU.
 *
 * Quality tiers: an owner may declare the lowest tier it runs at. Below it, its filters are left
 * out of the composed list but kept, so raising the tier brings them back in their place. An owner without a
 * `minTier` (the art direction, such as a palette lock) runs at every tier.
 */
export interface PostFilterSlot {
  /** Sets (or replaces) `id`'s filters. Returns a remover that only removes this setting, once. */
  set(id: string, filters: readonly Filter[], order?: number, options?: PostFilterOptions): () => void
  /** Removes `id`'s filters; nothing happens when it has none. */
  remove(id: string): void
  /** The owners whose filters run now, in the order they run. */
  readonly ids: readonly string[]
  /** The quality tier the slot composes for; `high` until `setTier`. */
  readonly tier: QualityTier
  /** Recomposes for `tier`, leaving out owners registered for a higher one. */
  setTier(tier: QualityTier): void
}

/** Options for `PostFilterSlot.set`. */
export interface PostFilterOptions {
  /** The lowest quality tier these filters run at; omitted, they run at every tier. */
  readonly minTier?: QualityTier | undefined
}

interface SlotEntry {
  readonly filters: readonly Filter[]
  readonly order: number
  readonly minTier: QualityTier
}

/** A post-filter slot writing its composed filters to `target`'s `filters`. */
export function createPostFilterSlot(target: PostFilterTarget): PostFilterSlot {
  const entries = new Map<string, SlotEntry>()
  let ordered: string[] = []
  let tier: QualityTier = 'high'

  const compose = () => {
    ordered = [...entries.keys()]
      .filter((id) => meetsTier(tier, entries.get(id)?.minTier ?? 'low'))
      .sort((a, b) => {
        const byOrder = (entries.get(a)?.order ?? 0) - (entries.get(b)?.order ?? 0)
        return byOrder !== 0 ? byOrder : a < b ? -1 : a > b ? 1 : 0
      })
    const filters = ordered.flatMap((id) => [...(entries.get(id)?.filters ?? [])])
    target.filters = filters.length > 0 ? filters : null
  }

  return {
    set(id, filters, order = 0, options = {}) {
      const entry: SlotEntry = { filters: [...filters], order, minTier: options.minTier ?? 'low' }
      entries.set(id, entry)
      compose()
      return () => {
        // Only the setting this remover came from: a later `set` of the same id is another owner's.
        if (entries.get(id) !== entry) return
        entries.delete(id)
        compose()
      }
    },
    remove(id) {
      if (entries.delete(id)) compose()
    },
    get ids() {
      return ordered
    },
    get tier() {
      return tier
    },
    setTier(next) {
      if (next === tier) return
      tier = next
      compose()
    },
  }
}
