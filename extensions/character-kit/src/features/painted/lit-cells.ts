// The lit cells of one painted figure. Lighting a cell takes the builder's `lightSprite` (about a millisecond at D2), so a figure
// that stands still, or walks through even light, lights each distinct frame once: a lit cell depends on the painted cell
// and on the quantised light (`RoomLight.key`), and the two together are the cache's key.
// The key is the painted cell's key and the light's. It does not hash the normals or `pitch`, which `lightSprite` also reads (the plan accepted this: both follow from
// the painted cell's pose and view, which its key names). The oldest cell is dropped first, and a hit does not
// refresh it: a walk that crosses more than `LIT_CELLS` keys in a cycle misses either way (a cyclic walk thrashes a least-recently-used cache as it does this one).
import { type Cell, cellOf, type Figure, lightSprite } from '../../shared/figure-builder/door.ts'
import type { RoomLight } from './room-light.ts'

/** How many lit cells one figure keeps (about 3 MB at D2): a walk cycle through a few light steps. */
export const LIT_CELLS = 32

export interface LitCells {
  /**
   * The figure's cell lit by `light`: its `painted`, `normals`, `depth`, `weave`, `anchor` and `direction` are this frame's, its
   * `rgba` and `key` the lit ones (the key names the painted cell and the light, so it changes whenever the lit colours may). The cache
   * holds the lit buffer and its key only, so nothing stale can come back with a hit.
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
        // The lit cell's key is the painted cell's and the light's, not a hash of its 98 KB of colours: a lit cell is a pure function
        // of the two, so they name it as surely, and the hash was the second cost of a miss.
        hit = { rgba: lightSprite(figure, light.lighting), key: `${unlit.key}|${light.key}` }
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
