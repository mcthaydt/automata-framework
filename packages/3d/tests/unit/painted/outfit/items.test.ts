import { describe, expect, it, vi } from 'vitest'
import { J } from '#src/features/painted/body/rig.ts'
import { type ItemDef, itemOf } from '#src/features/painted/outfit/items.ts'

// Each case paints whole figures, seconds apiece with the suite's files side by side; the source's own suite allows
// 30 s, and so does this file.
vi.setConfig({ testTimeout: 30_000 })

/**
 * Items built from data (items.ts itemOf, which a fork builds its own into ITEMS with): a part's `taper` narrows it from
 * its bottom to its top (a cup's foot, a glass's), so the same part with and without it is a different mesh, the same
 * every time it is built.
 */
const cup = (taper?: [number, number]): ItemDef => ({
  parts: [{ material: 'wood', at: [0, 0, 0.05], r: [0.04, 0.04, 0.05], ...(taper ? { taper } : {}) }],
  hold: { hand: [{ k: 0.1 }, { k: 0.1 }, { k: 0.1 }], turn: [0, 0, 0], pole: [0, 0, 1] },
})
const shape = (def: ItemDef) =>
  itemOf(def)
    .parts(J['socket.L'])
    .flatMap((p) => p.mesh.positions)

describe("an item's taper", () => {
  it('changes its parts, and builds the same twice', () => {
    expect(shape(cup([0.6, 1]))).not.toEqual(shape(cup()))
    expect(shape(cup([0.6, 1]))).toEqual(shape(cup([0.6, 1])))
  })
})
