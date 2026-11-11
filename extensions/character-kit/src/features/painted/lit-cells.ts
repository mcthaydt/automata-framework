// The lit cells of one painted figure. Lighting a cell takes the builder's `lightSprite` (about a millisecond at D2), so a figure
// that stands still, or walks through even light, lights each distinct frame once: a lit cell depends on the painted cell
// and on the quantised light (`RoomLight.key`), and the two together are the cache's key.
import { type Cell, cellOf, type Figure, lightSprite } from '../../shared/figure-builder/door.ts'
import type { RoomLight } from './room-light.ts'

/** How many lit cells one figure keeps (about 3 MB at D2): a walk cycle through a few light steps. */
export const LIT_CELLS = 32

export interface LitCells {
  /**
   * The figure's cell lit by `light`: its `painted`, `normals`, `depth`, `weave`, `anchor` and `direction` are this frame's, its
   * `rgba` and `key` the lit ones. The cache holds the lit buffer and its key only, so nothing stale can come back with a hit.
   */
  lit(figure: Figure, light: RoomLight): Cell
  /** How many lit cells are kept. */
  readonly size: number
}

/** A cache of at most `limit` lit cells, the oldest dropped first. */
export function litCells(limit = LIT_CELLS): LitCells {
  const kept = new Map<string, { readonly rgba: Uint8ClampedArray; readonly key: string }>()
  return {
    lit(figure, light) {
      // The painter's own call, so the unlit cell's hash is paid once, as it is without a light.
      const unlit = cellOf(figure)
      const id = `${unlit.key}|${light.key}`
      let hit = kept.get(id)
      if (hit === undefined) {
        // The lit buffer's key is the builder's own (a hash of its colours), made once on the miss.
        const { rgba, key } = cellOf(figure, lightSprite(figure, light.lighting))
        hit = { rgba, key }
        kept.set(id, hit)
        const oldest = kept.keys().next()
        if (kept.size > limit && oldest.done !== true) kept.delete(oldest.value)
      }
      return { ...unlit, rgba: hit.rgba, key: hit.key }
    },
    get size() {
      return kept.size
    },
  }
}
