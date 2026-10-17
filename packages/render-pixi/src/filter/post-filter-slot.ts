import type { Filter } from 'pixi.js'

/** Where the composed filters go: `PixiStage` (its scene's `filters`), or any Pixi container. */
export interface PostFilterTarget {
  filters: Filter[] | null
}

/**
 * The post-filter slot (PRODUCT spec §2 F1): each owner (an extension, quality tiers, the game) keeps its own
 * filters under its id, and the slot writes all of them to the target, ordered by `order` (lower first), then
 * by id. Once a slot is in use it owns the target's `filters`; assigning them directly is overwritten on the
 * next change. Filters stay GLSL + WGSL pairs (`filterPrograms`), so WebGL2 keeps parity with WebGPU.
 */
export interface PostFilterSlot {
  /** Sets (or replaces) `id`'s filters. Returns a remover that only removes this setting, once. */
  set(id: string, filters: readonly Filter[], order?: number): () => void
  /** Removes `id`'s filters; nothing happens when it has none. */
  remove(id: string): void
  /** The owners in the order their filters run. */
  readonly ids: readonly string[]
}

interface SlotEntry {
  readonly filters: readonly Filter[]
  readonly order: number
}

export function createPostFilterSlot(target: PostFilterTarget): PostFilterSlot {
  const entries = new Map<string, SlotEntry>()
  let ordered: string[] = []

  const compose = () => {
    ordered = [...entries.keys()].sort((a, b) => {
      const byOrder = (entries.get(a)?.order ?? 0) - (entries.get(b)?.order ?? 0)
      return byOrder !== 0 ? byOrder : a < b ? -1 : a > b ? 1 : 0
    })
    const filters = ordered.flatMap((id) => [...(entries.get(id)?.filters ?? [])])
    target.filters = filters.length > 0 ? filters : null
  }

  return {
    set(id, filters, order = 0) {
      const entry: SlotEntry = { filters: [...filters], order }
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
  }
}
